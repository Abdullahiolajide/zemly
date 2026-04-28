-- Create the "documents" bucket
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Set up RLS policies for the documents bucket
create policy "Allow authenticated uploads to documents"
on storage.objects
for insert
to authenticated
with check ( bucket_id = 'documents' AND owner = auth.uid() );

create policy "Allow authenticated reads from documents"
on storage.objects
for select
to authenticated
using ( bucket_id = 'documents' AND owner = auth.uid() );

create policy "Allow authenticated deletes from documents"
on storage.objects
for delete
to authenticated
using ( bucket_id = 'documents' AND owner = auth.uid() );

create policy "Allow authenticated updates to documents"
on storage.objects
for update
to authenticated
using ( bucket_id = 'documents' AND owner = auth.uid() );
