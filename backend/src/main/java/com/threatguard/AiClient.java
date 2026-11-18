package com.threatguard;

import java.net.http.HttpClient;
import java.time.Duration;

import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import static com.threatguard.ApiModels.*;

@Component
class AiClient {
    private final RestClient client;
    private final Validator validator;
    private final int timeoutSeconds;

    AiClient(RestClient.Builder builder, Validator validator,
             @Value("${ai.service-url}") String serviceUrl,
             @Value("${ai.timeout-seconds}") int timeoutSeconds) {
        if (timeoutSeconds < 1) {
            throw new IllegalArgumentException("AI timeout must be positive");
        }
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        this.client = builder.baseUrl(serviceUrl).requestFactory(factory).build();
        this.validator = validator;
        this.timeoutSeconds = timeoutSeconds;
    }

    int processingLeaseSeconds() {
        return Math.addExact(timeoutSeconds, 15);
    }

    Analysis analyze(AiRequest request) {
        Analysis result;
        try {
            result = client.post().uri("/ai/chat").contentType(MediaType.APPLICATION_JSON)
                    .body(request).retrieve().body(Analysis.class);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The AI service could not complete the analysis.");
        }
        if (result == null || !validator.validate(result).isEmpty()
                || result.incidentDetected() != (result.incidentType() != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The AI service returned an invalid analysis.");
        }
        return result;
    }
}
