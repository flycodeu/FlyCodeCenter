package dev.flycode.example;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class LoginCipher {
    private static final byte[] INFO = "streamfusion-login-v1".getBytes(StandardCharsets.US_ASCII);
    private final Clock clock;
    private final ObjectMapper json;
    private final SecureRandom random = new SecureRandom();

    public LoginCipher(Clock clock, ObjectMapper json) {
        this.clock = clock;
        this.json = json;
    }

    public record Challenge(String id, byte[] privateKey, String publicKey, Instant expiresAt) {
        @Override
        public String toString() { return "Challenge[REDACTED]"; }
    }

    public record Envelope(String challengeId, String clientPublicKey, String iv, String ciphertext) {}

    public record Credentials(String username, String password, String captchaId, String captchaAnswer) {
        @Override
        public String toString() { return "Credentials[REDACTED]"; }
    }

    public Challenge create() {
        try {
            var generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"), random);
            var pair = generator.generateKeyPair();
            byte[] id = new byte[16];
            random.nextBytes(id);
            return new Challenge(HexFormat.of().formatHex(id), pair.getPrivate().getEncoded(),
                    encode(pair.getPublic().getEncoded()), clock.instant().plusSeconds(120));
        } catch (Exception failure) {
            throw new IllegalStateException("Unable to create demo challenge");
        }
    }

    public Credentials decrypt(Challenge challenge, Envelope input) {
        if (challenge == null || input == null || !challenge.id().equals(input.challengeId())
                || !clock.instant().isBefore(challenge.expiresAt())) throw new Rejected();
        try {
            byte[] publicBytes = decode(input.clientPublicKey(), 200);
            byte[] iv = decode(input.iv(), 12);
            byte[] ciphertext = decode(input.ciphertext(), 2064);
            if (iv.length != 12 || ciphertext.length < 17) throw new Rejected();
            var keys = KeyFactory.getInstance("EC");
            var agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(keys.generatePrivate(new PKCS8EncodedKeySpec(challenge.privateKey())));
            agreement.doPhase(keys.generatePublic(new X509EncodedKeySpec(publicBytes)), true);
            byte[] key = hkdf(agreement.generateSecret(), HexFormat.of().parseHex(challenge.id()));
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            cipher.updateAAD(challenge.id().getBytes(StandardCharsets.US_ASCII));
            byte[] clear = cipher.doFinal(ciphertext);
            if (clear.length > 2048) throw new Rejected();
            var credentials = json.readValue(clear, Credentials.class);
            if (credentials == null || credentials.username() == null || credentials.password() == null
                    || credentials.captchaId() == null || credentials.captchaAnswer() == null)
                throw new Rejected();
            return credentials;
        } catch (Exception rejected) {
            throw new Rejected();
        }
    }

    private static byte[] hkdf(byte[] secret, byte[] salt) throws Exception {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(secret);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(INFO);
        mac.update((byte) 1);
        return mac.doFinal();
    }

    private static byte[] decode(String value, int maxBytes) {
        if (value == null || value.length() > maxBytes * 2 || !value.matches("[A-Za-z0-9_-]+"))
            throw new Rejected();
        byte[] bytes = Base64.getUrlDecoder().decode(value);
        if (bytes.length > maxBytes) throw new Rejected();
        return bytes;
    }

    private static String encode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    public static class Rejected extends RuntimeException {}
}
