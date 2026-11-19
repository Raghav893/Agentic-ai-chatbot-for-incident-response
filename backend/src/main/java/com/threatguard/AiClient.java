package com.threatguard;

import java.io.InputStream;
import java.net.http.HttpClient;
import java.time.Duration;

import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import static com.threatguard.ApiModels.*;

@Component
class AiClient {
    private final RestClient client;
    private final RestClient scanClient;
    private final Validator validator;
    private final int timeoutSeconds;

    AiClient(RestClient.Builder builder, Validator validator,
             @Value("${ai.service-url}") String serviceUrl,
             @Value("${ai.timeout-seconds}") int timeoutSeconds,
             @Value("${ai.scan-timeout-seconds}") int scanTimeoutSeconds) {
        if (timeoutSeconds < 1) {
            throw new IllegalArgumentException("AI timeout must be positive");
        }
        if (scanTimeoutSeconds < 1) {
            throw new IllegalArgumentException("File scan timeout must be positive");
        }
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        this.client = buildClient(builder, http, serviceUrl, timeoutSeconds);
        this.scanClient = buildClient(builder, http, serviceUrl, scanTimeoutSeconds);
        this.validator = validator;
        this.timeoutSeconds = timeoutSeconds;
    }

    private static RestClient buildClient(RestClient.Builder builder, HttpClient http, String serviceUrl, int timeoutSeconds) {
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        return builder.clone().baseUrl(serviceUrl).requestFactory(factory).build();
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

    FileScan scan(InputStream file, long size) {
        FileScan result;
        try {
            result = scanClient.post().uri("/ai/scan-file").contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .contentLength(size).body(new InputStreamResource(file)).retrieve().body(FileScan.class);
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 413) {
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Choose a file no larger than 20 MiB.");
            }
            if (exception.getStatusCode().value() == 400) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The scanner could not read the uploaded file.");
            }
            return incompleteScan();
        } catch (RestClientException exception) {
            return incompleteScan();
        }
        if (result == null || !validator.validate(result).isEmpty()) {
            return incompleteScan();
        }
        return result;
    }

    private static FileScan incompleteScan() {
        return new FileScan(ScanStatus.SCAN_INCOMPLETE, null, null, "The file scanner did not return a result.");
    }
}
