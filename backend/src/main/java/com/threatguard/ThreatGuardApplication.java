package com.threatguard;

import java.util.TimeZone;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@OpenAPIDefinition(info = @Info(title = "ThreatGuard Chat API", version = "0.1.0"))
@SpringBootApplication
public class ThreatGuardApplication {
    public static void main(String[] args) {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(ThreatGuardApplication.class, args);
    }
}
