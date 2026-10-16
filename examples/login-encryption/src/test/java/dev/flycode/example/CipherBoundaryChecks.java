package dev.flycode.example;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Standalone checks: no JUnit dependency and no waiting for a real 120-second timeout. */
public class CipherBoundaryChecks {
    private static final Instant START = Instant.parse("2026-01-01T00:00:00Z");
    private static final ObjectMapper JSON = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        var challenge = at(0).create();
        var envelope = seal(challenge);
        if (!"reader_demo".equals(at(119).decrypt(challenge, envelope).username()))
            throw new AssertionError("119 seconds should be accepted");
        reject(() -> at(120).decrypt(challenge, envelope), "120-second boundary");
        reject(() -> at(121).decrypt(challenge, envelope), "past expiry");
        reject(() -> at(0).decrypt(null, envelope), "missing challenge");
        System.out.println("PASS: 4 clock/challenge checks (119 accepted; 120/121 and missing rejected)");
    }

    private static LoginCipher at(long seconds) {
        return new LoginCipher(Clock.fixed(START.plusSeconds(seconds), ZoneOffset.UTC), JSON);
    }

    private static void reject(Runnable action, String name) {
        try {
            action.run();
            throw new AssertionError("Expected rejection: " + name);
        } catch (LoginCipher.Rejected expected) {
            // Only this specific rejection counts as a passing check.
        }
    }

    private static LoginCipher.Envelope seal(LoginCipher.Challenge challenge) throws Exception {
        var generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        var client = generator.generateKeyPair();
        var server = KeyFactory.getInstance("EC").generatePublic(
                new X509EncodedKeySpec(Base64.getUrlDecoder().decode(challenge.publicKey())));
        var agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(client.getPrivate());
        agreement.doPhase(server, true);
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(HexFormat.of().parseHex(challenge.id()), "HmacSHA256"));
        byte[] prk = mac.doFinal(agreement.generateSecret());
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update("streamfusion-login-v1".getBytes(StandardCharsets.US_ASCII));
        mac.update((byte) 1);
        byte[] key = mac.doFinal();
        byte[] iv = new byte[12];
        new java.security.SecureRandom().nextBytes(iv);
        var aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        aes.updateAAD(challenge.id().getBytes(StandardCharsets.US_ASCII));
        var input = new LoginCipher.Credentials("reader_demo", "DemoOnly!2026",
                "11111111111111111111111111111111", "A2B3C");
        var base64 = Base64.getUrlEncoder().withoutPadding();
        return new LoginCipher.Envelope(challenge.id(), base64.encodeToString(client.getPublic().getEncoded()),
                base64.encodeToString(iv), base64.encodeToString(aes.doFinal(JSON.writeValueAsBytes(input))));
    }
}
