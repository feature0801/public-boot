package com.main.infra.config;

import org.modelmapper.ModelMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.main.infra.utils.MapperUtils;

/**
 * MapperUtils 가 사용하는 ModelMapper 를 Bean 으로도 노출한다.
 * (동일 인스턴스이므로 어디서 커스터마이징해도 설정이 공유된다.)
 */
@Configuration
public class ModelMapperConfig {

	@Bean
	public ModelMapper modelMapper() {
		return MapperUtils.getModelMapper();
	}
}
