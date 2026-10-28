-- A title for each drawing (shown with its posters; never printed on them),
-- and a preview of how each poster looks in the panel's six inks.
alter table public.drawings add column title text check (char_length(title) between 1 and 60);
alter table public.generations add column preview_path text;
