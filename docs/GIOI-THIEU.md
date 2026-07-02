# Spa Scheduling Optimizer

Spa Scheduling Optimizer là web application giúp spa quản lý lịch làm việc của kỹ thuật viên, dịch vụ và booking, đồng thời tự động gợi ý các khung giờ đặt lịch hợp lý cho khách hàng. Dự án được xây dựng theo hướng MVP thực dụng: admin có giao diện tiếng Việt để vận hành lịch hẹn hằng ngày, còn backend tập trung vào các rule kiểm tra lịch và engine gợi ý slot có thể test độc lập.

## Vấn đề giải quyết

Với spa có nhiều kỹ thuật viên, nhiều dịch vụ và kỹ năng khác nhau, việc xếp lịch thủ công dễ dẫn đến trùng booking, chọn sai kỹ thuật viên, đặt ngoài giờ làm việc hoặc tạo ra các khoảng trống lẻ khó tận dụng. Hệ thống giải quyết các vấn đề này bằng cách chuẩn hóa dữ liệu lịch làm việc, ngày nghỉ, booking và kỹ năng, sau đó dùng API để kiểm tra tính hợp lệ trước khi tạo hoặc dời lịch.

Booking được lưu theo `date`, `startMin`, `endMin`, trong đó thời gian là số phút tính từ nửa đêm. Các khoảng thời gian dùng mô hình half-open interval `[start, end)`, nên hai booking chạm nhau ở điểm kết thúc/bắt đầu vẫn được xem là hợp lệ. Route booking kiểm tra kỹ thuật viên có đúng kỹ năng, slot nằm trong giờ làm, không trùng ngày nghỉ và không overlap với booking chưa hủy.

## Tính năng chính

- Giao diện admin tiếng Việt gồm: Tổng quan, Lịch đặt, Kỹ thuật viên, Dịch vụ, Lịch làm việc, Ngày nghỉ, Thống kê và Cài đặt.
- Quản lý kỹ thuật viên, kỹ năng, dịch vụ, lịch làm việc, ngày nghỉ và booking.
- Timeline calendar theo kỹ thuật viên bằng FullCalendar resource timeline để theo dõi lịch đặt.
- API CRUD cho technician, skill, service, schedule và booking.
- Chống double-booking ở server bằng kiểm tra overlap trên các booking không ở trạng thái `cancelled`.
- Slot Suggestion Engine: tính năng lõi của dự án, dùng để đề xuất các khung giờ khả dụng tốt nhất cho một dịch vụ trong khoảng thời gian khách mong muốn.

### Slot Suggestion Engine

Endpoint `GET /api/slots/suggest` nhận `serviceId`, `date`, `from`, `to` và `limit`. Server load dịch vụ để lấy `durationMin` và `skillId`, lọc các kỹ thuật viên active có kỹ năng tương ứng, lấy giờ làm việc theo thứ trong tuần, trừ ngày nghỉ và các booking chưa hủy để tạo danh sách free interval. Từ đó engine sinh candidate start trên grid 15 phút và chỉ giữ slot mà `[start, start + durationMin)` nằm trọn trong một free interval.

Mỗi slot hợp lệ được chấm điểm trong khoảng `[0, 1]` theo công thức:

```txt
score = 0.40 * proximity + 0.30 * load + 0.30 * gap
```

Ba rule chấm điểm:

- `proximity` ưu tiên slot bắt đầu gần thời điểm khách mong muốn (`from`). Slot càng lệch xa về sau trong window thì điểm càng giảm tuyến tính.
- `load` ưu tiên kỹ thuật viên ít booking hơn trong ngày, tính theo `1 / (1 + bookingCount)`.
- `gap` giảm các khoảng trống lẻ khó dùng. Sau khi đặt slot vào free interval, fragment nhỏ hơn `MIN_BOOKABLE_MIN = 30` phút bị xem là dead waste; càng ít dead waste thì điểm càng cao.

Kết quả được sort theo `score` giảm dần, tie-break bằng giờ bắt đầu sớm hơn, kỹ thuật viên ít tải hơn, rồi `technicianId` để đảm bảo deterministic. Response trả cả `breakdown` để UI hoặc reviewer thấy vì sao một slot được xếp hạng cao hơn.

## Tech stack và kiến trúc

Client sử dụng React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react và FullCalendar resource timeline. Vite đặt root ở `src/client`, build ra `dist/client`, đồng thời proxy `/api` sang Workers dev server ở port `8787`.

Backend là một Cloudflare Worker dùng Hono. Worker mount các route dưới `/api/*` và phục vụ SPA asset qua binding `ASSETS`. Data layer dùng Drizzle ORM trên Cloudflare D1 (SQLite), validate input bằng Zod. Database có 7 bảng chính: `technicians`, `skills`, `technician_skills`, `services`, `working_hours`, `time_off`, `bookings`.

Kiến trúc tổng quát:

- Một Cloudflare Worker tại `src/server/index.ts`/`src/server/app.ts`.
- API Hono cho `/api/technicians`, `/api/skills`, `/api/services`, `/api/schedule`, `/api/bookings`, `/api/slots`.
- SPA React build từ Vite và được Workers Assets phục vụ.
- Logic interval và suggestion được tách thành các hàm pure trong `src/server/lib/slots.ts` và `src/server/lib/suggest.ts`, giúp unit test không phụ thuộc DB.

## Cách chạy dev

Cài dependency:

```bash
npm install
```

Tạo/migrate database local D1 và seed dữ liệu mẫu:

```bash
npm run db:migrate
npm run db:seed
```

Chạy client Vite và Cloudflare Worker cùng lúc:

```bash
npm run dev
```

Các script hữu ích khác:

```bash
npm test
npm run lint
npm run build
```
