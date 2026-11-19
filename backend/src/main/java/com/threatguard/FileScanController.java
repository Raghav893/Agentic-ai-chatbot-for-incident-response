package com.threatguard;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static com.threatguard.ApiModels.FileScan;

@RestController
class FileScanController {
    private final AiClient ai;

    FileScanController(AiClient ai) {
        this.ai = ai;
    }

    @PostMapping(path = "/api/scans/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    FileScan scan(@RequestPart("file") MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a non-empty file to scan.");
        }
        try (var content = file.getInputStream()) {
            return ai.scan(content, file.getSize());
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded file could not be read.");
        }
    }
}
