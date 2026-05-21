# AIKeep24-Lite

> **AI와 나눈 모든 대화를 다시 찾아드립니다. LLM 불필요. 설치 즉시. 100% 무료.**

[기존 AIKeep24](https://github.com/aikorea24/aikeep24)의 진입장벽(Ollama + Apple Silicon 16GB)을 제거한 **완전히 별도의 제품**입니다.  
ChatGPT, Claude.ai, Genspark 대화를 자동 저장하고, 풀텍스트 검색으로 즉시 찾아줍니다.

---

## 핵심 기능

- **자동 캡처**: ChatGPT / Claude.ai / Genspark 대화를 백그라운드에서 자동 저장
- **풀텍스트 검색**: n-gram 한국어 지원 포함, 과거 대화를 키워드로 즉시 검색
- **원본 점프**: 검색 결과 클릭 → 원본 대화 URL로 바로 이동
- **SNAP**: 최근 10턴 raw text 클립보드 복사
- **데이터 내보내기**: JSON / Markdown 형식

## 데이터는 당신 것

| 모드 | 저장 위치 | 회원가입 |
|------|----------|---------|
| **Mode A (기본값)** | 브라우저 IndexedDB (완전 로컬) | 불필요 |
| **Mode B (선택)** | Cloudflare D1 (기기 간 동기화) | 불필요 (익명 UUID) |

---

## 설치 (Mode A — 권장)

1. 이 저장소 ZIP 다운로드 또는 `git clone`
2. `chrome://extensions` → 개발자 모드 ON → **Load unpacked** → `extension/` 폴더 선택
3. ChatGPT / Claude.ai / Genspark 열면 즉시 작동

> Mode A → Mode B 전환 시 기존 로컬 데이터는 자동 마이그레이션되지 않습니다 (v0.2.0 예정).  
> 전환 전 반드시 **내보내기(Export)**를 먼저 실행하세요.

---

## AIKeep24 (기존) 와의 차이

| 항목 | AIKeep24 | AIKeep24-Lite |
|------|----------|---------------|
| LLM 필요 | Ollama + EXAONE 필수 | **없음** |
| 자동 요약/태깅 | 있음 | 없음 (raw text 저장) |
| 시맨틱 검색 | Vectorize + bge-m3 | 없음 |
| 풀텍스트 검색 | 없음 | **FTS5 + n-gram** |
| 진입장벽 | Apple Silicon 16GB+ | **없음** |
| 데이터 위치 | Cloudflare D1 | 로컬 또는 D1 선택 |
| 라이선스 | AGPL-3.0 | **MIT** |

---

## 검색 작동 방식

LLM / 벡터 임베딩 없이 **FTS5 풀텍스트 + n-gram** 방식으로 검색합니다.

- 영어: 공백 기반 토크나이저
- 한국어: bigram + trigram 분해로 부분 매칭 지원
  - 예: "머신러닝" → "머신", "신러", "러닝", "머신러", "신러닝"
- 검색 결과에 매칭 스니펫 하이라이트 표시

---

## 기술 스택 (개발자용)

Extension: Chrome MV3, MutationObserver  
검색(Mode A): [minisearch](https://github.com/lucaong/minisearch) + n-gram 커스텀 토크나이저  
검색(Mode B): SQLite FTS5 가상 테이블 + unicode61 tokenizer  
한국어: bigram + trigram 인덱싱 (`ngram.js`)  
백엔드: Cloudflare Workers + D1 (Mode B만)

---

## 라이선스

[MIT](LICENSE) — 자유롭게 사용, 수정, 배포 가능합니다.

Contact: info@aikorea24.kr | [aikorea24.kr](https://aikorea24.kr)
