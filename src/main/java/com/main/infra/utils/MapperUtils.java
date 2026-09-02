package com.main.infra.utils;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import org.modelmapper.ModelMapper;
import org.modelmapper.config.Configuration.AccessLevel;
import org.modelmapper.convention.MatchingStrategies;

/**
 * ModelMapper 기반 객체 변환 유틸.
 */
public final class MapperUtils {

	private static final ModelMapper MODEL_MAPPER = create();


	private static ModelMapper create() {
		ModelMapper modelMapper = new ModelMapper();
		modelMapper.getConfiguration()
			.setMatchingStrategy(MatchingStrategies.STRICT)
			.setFieldMatchingEnabled(true)
			.setFieldAccessLevel(AccessLevel.PRIVATE)
			.setSkipNullEnabled(true);
		return modelMapper;
	}

	/**
	 * 내부 ModelMapper 인스턴스 반환. (TypeMap 커스터마이징 등에 사용)
	 */
	public static ModelMapper getModelMapper() {
		return MODEL_MAPPER;
	}

	/**
	 * 단일 객체 변환.
	 *
	 * @param source          변환 대상 (null 이면 null 반환)
	 * @param destinationType 변환 결과 타입
	 */
	public static <D> D map(Object source, Class<D> destinationType) {
		Objects.requireNonNull(destinationType, "destinationType must not be null");

		if (source == null) {
			return null;
		}
		return MODEL_MAPPER.map(source, destinationType);
	}

	/**
	 * 이미 생성된 객체에 값 복사.
	 *
	 * @param source      변환 대상 (null 이면 destination 을 그대로 반환)
	 * @param destination 값을 담을 객체
	 */
	public static <D> D map(Object source, D destination) {
		Objects.requireNonNull(destination, "destination must not be null");

		if (source == null) {
			return destination;
		}
		MODEL_MAPPER.map(source, destination);
		return destination;
	}

	/**
	 * List 객체 변환.
	 *
	 * @param source          변환 대상 목록 (null 또는 empty 이면 빈 List 반환)
	 * @param destinationType 변환 결과 타입
	 */
	public static <S, D> List<D> mapList(Collection<S> source, Class<D> destinationType) {
		Objects.requireNonNull(destinationType, "destinationType must not be null");

		if (source == null || source.isEmpty()) {
			return Collections.emptyList();
		}
		return source.stream()
			.map(element -> map(element, destinationType))
			.toList();
	}
}
