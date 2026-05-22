# Chrome Web Store 제출 체크리스트

## 필수 에셋
- [ ] 아이콘: 16x16, 48x48, 128x128 PNG (extension/icons/)
- [ ] 스크린샷: 1280x800 또는 640x400 PNG (최소 1장, 최대 5장)
- [ ] 프로모션 이미지: 440x280 PNG (선택)

## manifest.json 확인
- [x] version: 0.3.0
- [x] description 필드 있음
- [x] options_page 설정됨
- [x] host_permissions 최소화됨
- [ ] 개인정보처리방침 URL 추가 (privacy_policy 필드)

## 코드 검토
- [x] eval() 미사용
- [x] 외부 CDN 미사용 (minisearch 로컬 번들)
- [x] WORKER_URL이 하드코딩된 API_KEY 제거 필요 (배포 전)
- [ ] 불필요한 console.log 정리

## 스토어 등록 정보
- [x] 이름: AIKeep24-Lite
- [x] 설명: store/description.txt 참고
- [ ] 카테고리: Productivity
- [ ] 언어: 한국어 + English

## 제출 전 최종
- [ ] icons/ 실제 PNG 파일 존재 확인
- [ ] 확장 zip 생성: extension/ 폴더만 압축
- [ ] 개발자 계정 등록비 $5 결제 여부 확인
