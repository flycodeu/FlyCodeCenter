import json
import tempfile
import unittest
from pathlib import Path

from delivery import Delivery
from event_store import Store, normalize
from feishu import Feishu, card_fields, make_card, test_image


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'events.sqlite3'
        self.store = Store(self.path)
        self.calls = []
        self.fail = False
        self.worker = Delivery(self.store, self.remote, self.platform)

    def tearDown(self):
        self.worker.close()
        self.temp.cleanup()

    def remote(self, url, body=None, headers=None, **kwargs):
        self.calls.append((url, body, headers, kwargs))
        if url == 'https://images.example/alarm.png':
            return b'\x89PNG\r\n\x1a\nmock-image', 'image/png'
        if self.fail:
            raise ValueError('模拟飞书失败')
        if url.endswith('/internal'):
            result = {'code': 0, 'tenant_access_token': 'mock-token', 'expire': 7200}
        elif url.endswith('/images'):
            self.assertIn(b'name="image_type"', body)
            self.assertIn(b'mock-image', body)
            result = {'code': 0, 'data': {'image_key': 'mock-image-key'}}
        else:
            self.assertEqual(headers['Authorization'], 'Bearer mock-token')
            result = {'code': 0, 'data': {'message_id': 'om_mock'}}
        return json.dumps(result).encode(), 'application/json'

    def platform(self, action, payload, ca_file):
        self.assertEqual(action, 'picture')
        self.assertEqual(payload['body']['svrIndexCode'], 'image-server')
        return {'code': '0', 'data': {'picUrl': 'https://images.example/alarm.png'}}

    def configure(self, enabled=True):
        return self.store.save({'hik': {'appKey': 'test-key', 'appSecret': 'hik-test-secret'},
                               'camera': {'indexCode': 'camera-1', 'name': '热成像相机', 'location': '行政区域 / 垃圾房'},
                               'feishu': {'enabled': enabled, 'appId': 'cli_test', 'appSecret': 'feishu-test-secret', 'receiveId': 'oc_test'}})

    def event(self, **changes):
        return {'eventId': 'alarm-1', 'eventType': 192517, 'srcIndex': 'camera-1',
                'happenTime': '2026-10-21T14:23:53+08:00', 'status': 1, 'eventLvl': 1, **changes}

    def ingest(self, event):
        with self.store.connect() as db:
            self.store.ingest(db, {'params': {'events': [event]}}, '2026-10-21T06:23:54Z')

    def due(self):
        with self.store.connect() as db:
            db.execute('UPDATE alarms SET next_try=0')
            db.execute('UPDATE images SET next_try=0')

    def test_config_survives_restart_and_never_returns_secrets(self):
        public = self.configure()
        self.assertNotIn('appSecret', public['hik'])
        self.assertNotIn('appSecret', public['feishu'])
        self.assertTrue(public['feishu']['secretSaved'])
        self.store.save({'hik': {'appSecret': ''}, 'feishu': {'appSecret': ''}})
        other = Store(self.path)
        self.assertEqual(other.settings()['hik']['appSecret'], 'hik-test-secret')
        self.assertEqual(other.settings()['feishu']['appSecret'], 'feishu-test-secret')
        with self.assertRaises(ValueError):
            self.store.save({'feishu': {'baseUrl': 'https://other.example'}})
        with self.assertRaises(ValueError):
            self.store.save({'hik': {'appKey': 'other-key'}})

    def test_grade_does_not_use_device_alarm_level(self):
        alarm = normalize(self.event(eventLvl=None, data={'thermometry': [{'alarmLevel': 1}]}))
        self.assertEqual(alarm['level'], '未提供')
        self.assertEqual(normalize(self.event())['level'], '低')
        self.assertEqual(normalize(self.event(eventId=None))['eventId'], '')

    def test_real_temperature_fields_and_empty_fields_are_omitted(self):
        alarm = normalize(self.event(eventLvl=None, data={'thermometry': [{
            'curTemperature': '76.3', 'ruleTemperature': '70', 'thermometryUnit': 0,
            'alarmLevel': 0, 'ruleId': 0, 'imageUrl': 'http://images.example/thermal',
            'targetAttrs': {'picServerIndexCode': 'image-server'}}]}))
        self.assertEqual(alarm['measurements'][0]['value'], '76.3')
        self.assertEqual(alarm['images'][0]['serverCode'], 'image-server')
        fields = dict(card_fields(alarm))
        self.assertNotIn('地点', fields)
        self.assertNotIn('等级', fields)
        self.assertEqual(fields['温度'], '76.3℃')
        self.assertEqual(fields['报警阈值'], '70℃')
        card_text = json.dumps(make_card(alarm), ensure_ascii=False)
        self.assertNotIn('未提供', card_text)
        self.assertNotIn('部分图片未获取成功', card_text)

    def test_direct_image_is_downloaded_before_feishu_upload(self):
        self.configure()
        self.ingest(self.event(data={'thermometry': [{'imageUrl': 'https://images.example/alarm.png',
            'targetAttrs': {'imageServerCode': 'image-server'}, 'curTemperature': '76.3', 'ruleTemperature': '70', 'thermometryUnit': 0}]}))
        def no_picture_api(*args):
            self.fail('A working absolute image URL must be downloaded directly')
        self.worker.platform_call = no_picture_api
        self.due(); self.worker.once()
        self.assertEqual(self.calls[0][0], 'https://images.example/alarm.png')
        self.assertEqual(self.calls[0][2], {'Accept': 'image/*'})
        self.assertTrue(self.store.list_alarms()[0]['images'][0]['ready'])
        sent = json.loads(self.calls[-1][1])
        self.assertIn('76.3', sent['content'])
        self.assertIn('mock-image-key', sent['content'])

    def test_binary_stream_with_valid_image_signature_is_accepted(self):
        self.worker.transport = lambda *args, **kwargs: (b'\xff\xd8\xffjpeg-data', 'application/octet-stream')
        content, mime = self.worker.fetch_image({'uri': 'http://images.example/photo', 'server_code': ''})
        self.assertEqual(mime, 'image/jpeg')

    def test_expired_absolute_url_is_refreshed_using_relative_uri(self):
        def transport(url, *args, **kwargs):
            if '/old?' in url:
                raise ValueError('远端返回 HTTP 403；地址已过期')
            return b'\x89PNG\r\n\x1a\nmock-image', 'image/png'
        def picture(action, payload, ca):
            self.assertEqual(payload['body'], {'svrIndexCode': 'image-server', 'picUri': '/old?ticket=a*b;1?x=2', 'netProtocol': 'http'})
            return {'code': '0', 'data': {'picUrl': 'http://images.example/fresh'}}
        self.worker.transport, self.worker.platform_call = transport, picture
        self.assertEqual(self.worker.fetch_image({'uri': 'http://images.example/old?ticket=a*b;1?x=2', 'server_code': 'image-server'})[1], 'image/png')

    def test_image_network_error_identifies_host_without_ticket(self):
        def transport(*args, **kwargs):
            raise ValueError('远端连接失败或超时')
        def picture(*args):
            self.fail('Network failures must not request new signed URLs')
        self.worker.transport, self.worker.platform_call = transport, picture
        with self.assertRaises(ValueError) as caught:
            self.worker.fetch_image({'uri': 'http://172.17.8.23:6120/pic?private-ticket', 'server_code': 'image-server'})
        self.assertIn('172.17.8.23:6120', str(caught.exception))
        self.assertNotIn('private-ticket', str(caught.exception))

    def test_retry_images_recovers_temperature_from_saved_raw_event(self):
        self.configure()
        self.ingest(self.event(data={'thermometry': [{'ruleId': 0, 'curTemperature': '76.3', 'ruleTemperature': '70', 'thermometryUnit': 0}]}))
        with self.store.connect() as db:
            row = db.execute('SELECT * FROM alarms').fetchone()
            content = json.loads(row['content'])
            content['measurements'] = [{'ruleId': 0, 'value': None, 'threshold': None, 'unit': 0}]
            db.execute('UPDATE alarms SET content=?,push_state=\'sent\',message_id=\'om_mock\'', (json.dumps(content),))
        self.store.retry_images(row['id'])
        alarm = self.store.list_alarms()[0]
        self.assertEqual(alarm['measurements'][0]['value'], '76.3')
        self.worker.once()
        self.assertIn('76.3', self.calls[-1][1].decode())
        self.assertEqual(self.calls[-1][3]['method'], 'PATCH')

    def test_test_image_is_valid_png_and_missing_config_does_no_network(self):
        import struct
        import zlib
        image = test_image()
        self.assertTrue(image.startswith(b'\x89PNG\r\n\x1a\n'))
        position, compressed = 8, b''
        while position < len(image):
            size = struct.unpack('!I', image[position:position+4])[0]
            kind, data = image[position+4:position+8], image[position+8:position+8+size]
            crc = struct.unpack('!I', image[position+8+size:position+12+size])[0]
            self.assertEqual(zlib.crc32(kind+data) & 0xffffffff, crc)
            if kind == b'IDAT': compressed += data
            position += size + 12
        self.assertEqual(len(zlib.decompress(compressed)), (480*3+1)*240)
        with self.assertRaises(ValueError):
            Feishu(self.remote).send_test(self.store.settings()['feishu'])
        self.assertEqual(self.calls, [])

    def test_no_id_events_do_not_collapse_to_one_record(self):
        self.ingest(self.event(eventId=None))
        self.ingest(self.event(eventId=None, happenTime='2026-10-21T15:00:00+08:00'))
        self.assertEqual(len(self.store.list_alarms()), 2)

    def test_duplicate_then_picture_updates_existing_card(self):
        self.configure()
        self.ingest(self.event())
        self.ingest(self.event())
        self.assertEqual(self.calls, [])  # Callback ingestion does no network I/O.
        self.assertEqual(len(self.store.list_alarms()), 1)
        self.due(); self.worker.once()
        first = self.store.list_alarms()[0]
        self.assertEqual(first['pushState'], 'sent')
        self.assertEqual(first['messageId'], 'om_mock')
        sent = json.loads(self.calls[-1][1])
        card = json.loads(sent['content'])
        self.assertIn('行政区域 / 垃圾房', card['elements'][0]['text']['content'])
        self.assertIn('等级：低', card['elements'][0]['text']['content'])
        self.ingest(self.event(status=5, eventLvl=None, data={'thermometry': [{
            'imageUrl': '/picture/1', 'targetAttrs': {'imageServerCode': 'image-server'}}]}))
        self.due(); self.worker.once()
        alarm = self.store.list_alarms()[0]
        self.assertEqual(alarm['level'], '低')
        self.assertTrue(alarm['images'][0]['ready'])
        self.assertEqual(self.calls[-1][3]['method'], 'PATCH')
        self.assertEqual(sum('/messages?' in c[0] for c in self.calls), 1)
        self.assertEqual(sum(c[0].endswith('/internal') for c in self.calls), 1)
        self.assertIn('mock-image-key', self.calls[-1][1].decode())
        count = len(self.calls)
        self.worker.once()
        self.assertEqual(len(self.calls), count)

    def test_disabled_events_are_not_replayed_and_pending_is_cancelled(self):
        self.configure(False)
        self.ingest(self.event())
        self.store.save({'feishu': {'enabled': True}})
        self.due(); self.worker.once()
        self.assertEqual(self.calls, [])
        self.ingest(self.event(eventId='alarm-2'))
        self.store.save({'feishu': {'enabled': False}})
        self.due(); self.worker.once()
        self.assertEqual(self.calls, [])
        self.assertEqual(self.store.list_alarms()[0]['pushState'], 'cancelled')

    def test_camera_filter_and_new_recipient_never_replay_old_alarm(self):
        self.configure()
        self.ingest(self.event(srcIndex='other-camera'))
        self.due(); self.worker.once()
        self.assertEqual(self.calls, [])
        self.ingest(self.event())
        self.store.save({'feishu': {'receiveId': 'oc_other'}})
        self.due(); self.worker.once()
        self.assertEqual(self.calls, [])
        with self.assertRaises(ValueError):
            self.store.retry(self.store.list_alarms()[0]['id'])

    def test_bounded_retries_and_manual_retry_survive_restart(self):
        self.configure(); self.ingest(self.event()); self.fail = True
        for _ in range(5):
            self.due(); self.worker.once()
        self.assertEqual(len(self.calls), 3)
        self.assertEqual(self.store.list_alarms()[0]['pushState'], 'failed')
        self.store = Store(self.path)
        self.worker = Delivery(self.store, self.remote, self.platform)
        self.store.retry(self.store.list_alarms()[0]['id'])
        self.fail = False; self.worker.once()
        self.assertEqual(self.store.list_alarms()[0]['pushState'], 'sent')

    def test_stop_during_upload_prevents_message_send(self):
        self.configure()
        self.ingest(self.event(data={'thermometry': [{'imageUrl': 'https://images.example/alarm.png'}]}))
        original = self.worker.feishu.upload
        def upload(*args):
            key = original(*args)
            self.store.save({'feishu': {'enabled': False}})
            return key
        self.worker.feishu.upload = upload
        self.due(); self.worker.once()
        self.assertFalse(any('/messages' in c[0] for c in self.calls))
        self.assertEqual(self.store.list_alarms()[0]['pushState'], 'cancelled')


if __name__ == '__main__':
    unittest.main()
