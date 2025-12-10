package com.alibaba.cloud.ai.copilot.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * RestTemplate 全局配置
 *
 * 提供一个可注入的 RestTemplate Bean，避免因缺少 Bean 导致应用启动失败。
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}


