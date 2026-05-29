# Hướng dẫn import tài liệu vào Thư viện Hệ thống

Tài liệu hệ thống là tài liệu do admin/dev chuẩn bị sẵn, khác với tài liệu người dùng upload trong Notebook. Frontend không có dữ liệu mẫu hardcoded; muốn Thư viện Hệ thống hiển thị dữ liệu, bạn cần insert metadata vào `system_documents` và insert chunks + embeddings vào `system_document_chunks`.

## 1. Chạy SQL schema

Trong Supabase SQL Editor, chạy toàn bộ file:

```sql
-- docs/sql/system_library.sql
```

File này tạo:

- `system_documents`: metadata/catalog của tài liệu.
- `system_document_chunks`: nội dung chunk và vector embedding 768 chiều.
- `system_document_bookmarks`: trạng thái ghim theo từng user.
- Indexes, RLS policies, trigger `updated_at`.
- RPC `match_system_documents(...)` để semantic search theo pgvector.


## 2. Upload tự động bằng tài khoản admin trong app

Trong trang **Thư viện Hệ thống**, mở khối **Upload tài liệu hệ thống**. Backend kiểm tra tài khoản admin qua biến môi trường:

```env
SYSTEM_LIBRARY_ADMIN_EMAIL=admin
SYSTEM_LIBRARY_ADMIN_PASSWORD=admin
```

Với cấu hình mặc định dev, tài khoản là `admin` và mật khẩu là `admin`. Khi upload thành công, backend sẽ tự động:

1. Parse file PDF/DOCX/TXT/MD.
2. Insert metadata vào `system_documents` với `is_vector_ready = false`.
3. Chunk nội dung và tạo embedding.
4. Insert chunks vào `system_document_chunks`.
5. Update `system_documents.is_vector_ready = true`.

> Lưu ý: đổi `SYSTEM_LIBRARY_ADMIN_PASSWORD` trong production.

## 3. Chuẩn bị metadata tài liệu thủ công

Ví dụ insert một tài liệu PDF đã được admin/dev chuẩn bị:

```sql
insert into public.system_documents (
  title,
  filename,
  file_type,
  description,
  ai_summary,
  page_count,
  word_count,
  difficulty_level,
  subject_area,
  tags,
  access_level,
  is_vector_ready
) values (
  'Thủ tục thành lập công ty TNHH',
  'thu-tuc-thanh-lap-cong-ty-tnhh.pdf',
  'PDF',
  'Tài liệu hướng dẫn các bước pháp lý cơ bản khi thành lập công ty TNHH tại Việt Nam.',
  'Tóm tắt các bước chuẩn bị hồ sơ, đăng ký doanh nghiệp, nghĩa vụ sau thành lập và lưu ý về thuế.',
  42,
  18500,
  'intermediate',
  'Luật',
  array['Luật_Doanh_Nghiệp', 'Thành_Lập_Công_Ty', 'Thuế'],
  'free',
  false
)
returning id;
```

Ghi lại `id` trả về; đó là `document_id` dùng cho chunks.

## 4. Parse và chunk nội dung thủ công

Bạn có thể dùng lại pipeline backend hiện có:

1. Parse file bằng `app.services.document_parser.parse_document`.
2. Chia chunk bằng `app.services.chunker.chunk_text`.
3. Tạo embedding bằng `app.services.embedder.embed_chunks`.
4. Insert từng chunk vào `system_document_chunks` với `document_id` của tài liệu hệ thống.

Pseudo-code:

```python
from app.services.document_parser import parse_document
from app.services.chunker import chunk_text
from app.services.embedder import embed_chunks
from app.db.supabase_client import supabase

pages, file_type = await parse_document(file_bytes, filename)
chunks = chunk_text(pages)
embeddings = await embed_chunks([chunk['content'] for chunk in chunks])

rows = []
for chunk, embedding in zip(chunks, embeddings):
    rows.append({
        'document_id': system_document_id,
        'content': chunk['content'],
        'page_start': chunk.get('page_start') or chunk.get('page_number'),
        'page_end': chunk.get('page_end') or chunk.get('page_number'),
        'embedding': '[' + ','.join(map(str, embedding)) + ']',
    })

supabase.table('system_document_chunks').insert(rows).execute()
supabase.table('system_documents').update({'is_vector_ready': True}).eq('id', system_document_id).execute()
```

## 5. Kiểm tra semantic search

Sau khi có chunks và embeddings, kiểm tra RPC:

```sql
select *
from public.match_system_documents(
  '[0,0,0 /* vector 768 chiều thực tế */]'::vector,
  10,
  0
);
```

Trong app, search bar `Thư viện Hệ thống` sẽ gọi backend `/api/system-library/search`; backend sẽ thử RPC `match_system_documents` và fallback metadata nếu RPC/embedding chưa sẵn sàng.

## 6. Quyền truy cập và trạng thái dùng AI

- `access_level = 'free'`: user Free dùng được.
- `access_level = 'pro'`: cần user plan Pro hoặc VIP.
- `access_level = 'vip'`: cần user plan VIP.
- `is_vector_ready = false`: frontend disable nút Chat và backend trả `409 VECTOR_NOT_READY` nếu cố gọi.
- Khi import xong chunks + embeddings, update `is_vector_ready = true`.
