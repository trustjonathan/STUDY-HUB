-- Study Hub subject taxonomy used by the categorized subject directory.

create table if not exists public.study_hub_subject_categories (
  id text primary key,
  name text not null,
  filter_label text not null,
  description text not null,
  display_order smallint not null unique
);

create table if not exists public.study_hub_subject_catalog (
  slug text primary key,
  name text not null,
  category_id text not null references public.study_hub_subject_categories(id),
  display_order smallint not null,
  constraint study_hub_subject_catalog_category_order_unique unique (category_id, display_order)
);

create index if not exists study_hub_subject_catalog_category_idx
  on public.study_hub_subject_catalog (category_id, display_order);

alter table public.study_hub_subject_categories enable row level security;
alter table public.study_hub_subject_catalog enable row level security;

drop policy if exists "Study Hub subject categories are publicly readable"
  on public.study_hub_subject_categories;
create policy "Study Hub subject categories are publicly readable"
  on public.study_hub_subject_categories for select to anon, authenticated
  using (true);

drop policy if exists "Study Hub subjects are publicly readable"
  on public.study_hub_subject_catalog;
create policy "Study Hub subjects are publicly readable"
  on public.study_hub_subject_catalog for select to anon, authenticated
  using (true);

revoke all on public.study_hub_subject_categories from public, anon, authenticated;
revoke all on public.study_hub_subject_catalog from public, anon, authenticated;
grant select on public.study_hub_subject_categories to anon, authenticated;
grant select on public.study_hub_subject_catalog to anon, authenticated;

insert into public.study_hub_subject_categories (id, name, filter_label, description, display_order)
values
  ('sciences-math', 'Sciences & Math', 'Sciences', 'Investigate the natural world and build quantitative reasoning.', 1),
  ('languages', 'Languages', 'Languages', 'Develop communication through local and international languages.', 2),
  ('humanities-social', 'Humanities & Social', 'Humanities', 'Explore societies, belief, history, and economic choices.', 3),
  ('applied-technical', 'Applied & Technical', 'Applied', 'Build practical, creative, digital, and technical skills.', 4)
on conflict (id) do update set
  name = excluded.name,
  filter_label = excluded.filter_label,
  description = excluded.description,
  display_order = excluded.display_order;

insert into public.study_hub_subject_catalog (slug, name, category_id, display_order)
values
  ('biology', 'Biology', 'sciences-math', 1),
  ('chemistry', 'Chemistry', 'sciences-math', 2),
  ('physics', 'Physics', 'sciences-math', 3),
  ('mathematics', 'Mathematics', 'sciences-math', 4),
  ('english-language', 'English Language', 'languages', 1),
  ('kiswahili', 'Kiswahili', 'languages', 2),
  ('literature-in-english', 'Literature in English', 'languages', 3),
  ('french', 'French', 'languages', 4),
  ('german', 'German', 'languages', 5),
  ('arabic', 'Arabic', 'languages', 6),
  ('chinese', 'Chinese', 'languages', 7),
  ('luganda', 'Luganda', 'languages', 8),
  ('runyankole-rukiga', 'Runyankole-Rukiga', 'languages', 9),
  ('luo', 'Luo', 'languages', 10),
  ('geography', 'Geography', 'humanities-social', 1),
  ('history', 'History & Political Education', 'humanities-social', 2),
  ('cre', 'Christian Religious Education (CRE / Divinity)', 'humanities-social', 3),
  ('ire', 'Islamic Religious Education (IRE)', 'humanities-social', 4),
  ('economics', 'Economics', 'humanities-social', 5),
  ('general-paper', 'General Paper (GP)', 'humanities-social', 6),
  ('ict', 'Information & Communication Technology (ICT)', 'applied-technical', 1),
  ('agriculture', 'Agriculture', 'applied-technical', 2),
  ('entrepreneurship', 'Entrepreneurship Education', 'applied-technical', 3),
  ('technology-and-design', 'Technology & Design / Technical Drawing', 'applied-technical', 4),
  ('nutrition-and-food-technology', 'Nutrition & Food Technology / Home Economics', 'applied-technical', 5),
  ('art-and-design', 'Art & Design', 'applied-technical', 6),
  ('performing-arts-and-music', 'Performing Arts & Music', 'applied-technical', 7),
  ('physical-education', 'Physical Education (PE)', 'applied-technical', 8)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  display_order = excluded.display_order;