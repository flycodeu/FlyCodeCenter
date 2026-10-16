package dev.flycode.example;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class LoginController {
    private static final String CHALLENGE = "demo.challenge";
    private static final String CSRF = "demo.csrf";
    private final LoginCipher cipher;
    private final String origin;
    private final SecureRandom random = new SecureRandom();

    public LoginController(LoginCipher cipher, @Value("${demo.origin}") String origin) {
        this.cipher = cipher;
        this.origin = origin;
    }

    @GetMapping("/auth/login/challenge")
    public Map<String, String> challenge(HttpServletRequest request, HttpServletResponse response) {
        checkOrigin(request, false);
        response.setHeader("Cache-Control", "no-store");
        HttpSession session = request.getSession(true);
        synchronized (session) {
            if (session.getAttribute(CSRF) == null) {
                byte[] token = new byte[32];
                random.nextBytes(token);
                session.setAttribute(CSRF, Base64.getUrlEncoder().withoutPadding().encodeToString(token));
            }
            var challenge = cipher.create();
            session.setAttribute(CHALLENGE, challenge);
            response.setHeader("X-CSRF-Token", (String) session.getAttribute(CSRF));
            return Map.of("challengeId", challenge.id(), "serverPublicKey", challenge.publicKey());
        }
    }

    @PostMapping(value = "/auth/login/secure", consumes = "application/json")
    public ResponseEntity<Map<String, String>> login(@RequestBody LoginCipher.Envelope input,
            HttpServletRequest request, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        checkOrigin(request, true);
        HttpSession session = request.getSession(false);
        if (session == null) throw new LoginCipher.Rejected();
        LoginCipher.Challenge challenge;
        synchronized (session) {
            String expected = (String) session.getAttribute(CSRF);
            String supplied = request.getHeader("X-CSRF-Token");
            if (expected == null || supplied == null || !MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.US_ASCII), supplied.getBytes(StandardCharsets.US_ASCII)))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            challenge = (LoginCipher.Challenge) session.getAttribute(CHALLENGE);
            // 单进程内先消费再解密；错误密文也不能重用挑战。
            session.removeAttribute(CHALLENGE);
        }
        var credentials = cipher.decrypt(challenge, input);
        boolean matches = "reader_demo".equals(credentials.username())
                && "DemoOnly!2026".equals(credentials.password())
                && "11111111111111111111111111111111".equals(credentials.captchaId())
                && "A2B3C".equals(credentials.captchaAnswer());
        return ResponseEntity.status(matches ? HttpStatus.OK : HttpStatus.UNAUTHORIZED)
                .body(Map.of("code", matches ? "DEMO_MATCH" : "DEMO_MISMATCH", "message",
                        matches ? "密文解密成功，演示数据匹配；未建立真实登录身份。" : "演示数据不匹配。"));
    }

    private void checkOrigin(HttpServletRequest request, boolean required) {
        String supplied = request.getHeader("Origin");
        if ((required && supplied == null) || (supplied != null && !origin.equals(supplied))
                || "cross-site".equals(request.getHeader("Sec-Fetch-Site")))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler({LoginCipher.Rejected.class, HttpMessageNotReadableException.class})
    ResponseEntity<Map<String, String>> rejected() {
        return ResponseEntity.badRequest().header("Cache-Control", "no-store")
                .body(Map.of("code", "ENVELOPE_REJECTED", "message", "密文无效或挑战已失效，请重新获取挑战。"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).header("Cache-Control", "no-store")
                .body(Map.of("code", "ORIGIN_OR_CSRF_REJECTED", "message", "来源或CSRF校验未通过。"));
    }
}
