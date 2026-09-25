/**
 * 공통 유틸
 *
 * 사용 예)
 *   <script src="/js/utils.js"></script>
 *   const { base, target, changed } = Utils.compareVersion(원본, 비교본, { arrayKey: 'id' });
 *
 * 규칙
 * - 화살표 함수는 this 바인딩이 없으므로 내부 호출은 반드시 Utils.xxx 로 참조한다.
 * - `_` 로 시작하는 함수는 내부용이므로 외부에서 직접 호출하지 않는다.
 */
const Utils = {

    // =========================================================================
    // 공통
    // =========================================================================

    isPlainObject: (value) => Object.prototype.toString.call(value) === '[object Object]',

    deepClone: (value) => {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    },

    // =========================================================================
    // 버전 비교
    // =========================================================================

    CHANGE_TYPE: Object.freeze({
        UPDATE: 'UPDATE',
        ADD: 'ADD',       // 비교 데이터에만 존재
        DELETE: 'DELETE', // 기준 데이터에만 존재
        NONE: 'NONE',     // 변경 없음 (markUnchanged 옵션 사용 시)
    }),

    /**
     * 두 JSON 데이터(기준 / 비교)를 비교하여 변경 여부를 표시한다.
     *
     * - 원본 데이터는 변경하지 않고 복사본에 표시(marker)를 추가하여 반환한다.
     * - 키 `title` 의 값이 다르면 기준/비교 데이터 모두 `titleChange: 'UPDATE'` 가 추가된다.
     * - 뎁스 제한 없음, 키 불일치(추가/삭제), 일반 배열, 객체 배열(JSON list)을 모두 처리한다.
     *
     * @param {*} base 기준 데이터
     * @param {*} target 비교 데이터
     * @param {Object} [options]
     * @param {string} [options.suffix='Change'] 표시 키 접미사 (title -> titleChange)
     * @param {string} [options.itemMarkerKey='rowChange'] 객체 배열의 각 항목에 붙는 표시 키
     * @param {string|string[]|function(Object, string): *} [options.arrayKey]
     *   객체 배열 항목을 매칭할 식별 키. 문자열 배열이면 먼저 존재하는 키를 사용한다.
     *   지정하지 않거나 항목에 식별 값이 없으면 인덱스 순서로 매칭한다.
     * @param {boolean} [options.markUnchanged=false] 변경 없는 키에도 NONE 을 표시할지 여부
     * @returns {{ base: *, target: *, changed: boolean }}
     */
    compareVersion: (base, target, options = {}) => {
        const opts = {
            suffix: 'Change',
            itemMarkerKey: 'rowChange',
            arrayKey: undefined,
            markUnchanged: false,
            ...options,
        };
        const baseCopy = Utils.deepClone(base);
        const targetCopy = Utils.deepClone(target);
        const changed = Utils._compareValue(baseCopy, targetCopy, opts, '');

        return { base: baseCopy, target: targetCopy, changed };
    },

    _compareValue: (baseValue, targetValue, opts, path) => {
        if (Utils.isPlainObject(baseValue) && Utils.isPlainObject(targetValue)) {
            return Utils._compareObject(baseValue, targetValue, opts, path);
        }
        if (Array.isArray(baseValue) && Array.isArray(targetValue)) {
            return Utils._compareArray(baseValue, targetValue, opts, path);
        }
        return !Utils._isSamePrimitive(baseValue, targetValue);
    },

    _compareObject: (base, target, opts, path) => {
        const { CHANGE_TYPE } = Utils;
        // 표시 키가 추가되기 전에 비교 대상 키 목록을 확정한다.
        const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
        let changed = false;

        for (const key of keys) {
            const markerKey = key + opts.suffix;
            const inBase = Object.hasOwn(base, key);
            const inTarget = Object.hasOwn(target, key);

            let type;
            if (!inTarget) {
                type = CHANGE_TYPE.DELETE;
            } else if (!inBase) {
                type = CHANGE_TYPE.ADD;
            } else {
                const childPath = path ? `${path}.${key}` : key;
                type = Utils._compareValue(base[key], target[key], opts, childPath) ? CHANGE_TYPE.UPDATE : CHANGE_TYPE.NONE;
            }

            if (type !== CHANGE_TYPE.NONE) changed = true;
            if (type !== CHANGE_TYPE.NONE || opts.markUnchanged) {
                base[markerKey] = type;
                target[markerKey] = type;
            }
        }
        return changed;
    },

    _compareArray: (base, target, opts, path) => {
        const { CHANGE_TYPE } = Utils;
        const itemPath = `${path}[]`;
        const { pairs, removed, added } = Utils._pairItems(base, target, opts, itemPath);
        let changed = removed.length > 0 || added.length > 0;

        for (const [baseItem, targetItem] of pairs) {
            const itemChanged = Utils._compareValue(baseItem, targetItem, opts, itemPath);
            if (itemChanged) changed = true;
            if (itemChanged || opts.markUnchanged) {
                const type = itemChanged ? CHANGE_TYPE.UPDATE : CHANGE_TYPE.NONE;
                Utils._markItem(baseItem, type, opts);
                Utils._markItem(targetItem, type, opts);
            }
        }
        removed.forEach(item => Utils._markItem(item, CHANGE_TYPE.DELETE, opts));
        added.forEach(item => Utils._markItem(item, CHANGE_TYPE.ADD, opts));

        return changed;
    },

    /**
     * 배열 항목을 짝지어 준다. 식별 키로 매칭이 가능하면 키 기준, 아니면 인덱스 기준.
     * 반환되는 항목은 복사본 배열의 실제 참조이므로 표시가 그대로 반영된다.
     */
    _pairItems: (base, target, opts, path) => {
        const baseIds = Utils._resolveIds(base, opts.arrayKey, path);
        const targetIds = Utils._resolveIds(target, opts.arrayKey, path);

        if (baseIds && targetIds) {
            const targetIndexById = new Map(targetIds.map((id, i) => [id, i]));
            const matched = new Set();
            const pairs = [];
            const removed = [];

            base.forEach((item, i) => {
                const targetIndex = targetIndexById.get(baseIds[i]);
                if (targetIndex === undefined) {
                    removed.push(item);
                } else {
                    matched.add(targetIndex);
                    pairs.push([item, target[targetIndex]]);
                }
            });
            const added = target.filter((_, i) => !matched.has(i));
            return { pairs, removed, added };
        }

        const common = Math.min(base.length, target.length);
        return {
            pairs: base.slice(0, common).map((item, i) => [item, target[i]]),
            removed: base.slice(common),
            added: target.slice(common),
        };
    },

    /** 모든 항목의 식별 값을 구한다. 하나라도 없거나 중복이면 null (인덱스 매칭으로 대체). */
    _resolveIds: (items, arrayKey, path) => {
        if (arrayKey === undefined || arrayKey === null) return null;

        const ids = [];
        for (const item of items) {
            const id = Utils._getItemId(item, arrayKey, path);
            if (id === undefined || id === null) return null;
            ids.push(id);
        }
        return new Set(ids).size === ids.length ? ids : null;
    },

    _getItemId: (item, arrayKey, path) => {
        if (!Utils.isPlainObject(item)) return undefined;
        if (typeof arrayKey === 'function') return arrayKey(item, path);

        const keys = Array.isArray(arrayKey) ? arrayKey : [arrayKey];
        const key = keys.find(k => Object.hasOwn(item, k));
        return key === undefined ? undefined : item[key];
    },

    /** 객체 항목에만 표시한다. (원시값 배열 항목은 표시할 곳이 없으므로 상위 키의 표시로 확인) */
    _markItem: (item, type, opts) => {
        if (Utils.isPlainObject(item)) item[opts.itemMarkerKey] = type;
    },

    _isSamePrimitive: (a, b) => {
        if (typeof a === 'object' && a !== null) return false; // 타입 불일치 (객체 vs 배열 등)
        if (typeof b === 'object' && b !== null) return false;
        return Object.is(a, b) || a === b; // NaN 동일 처리, +0/-0 동일 처리
    },
};
