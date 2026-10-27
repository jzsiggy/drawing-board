-- Gallery: small poster thumbnails for the grid, and indexes for the
-- "been on the frame" lookups (displays -> renditions -> generations).

alter table public.generations add column thumb_path text;

create index renditions_generation_idx on public.renditions (generation_id);
create index displays_rendition_idx on public.displays (rendition_id);
