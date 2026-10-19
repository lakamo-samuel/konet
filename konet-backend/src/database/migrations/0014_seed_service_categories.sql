INSERT INTO service_categories (name, slug) VALUES
  ('Beauty & Grooming', 'beauty-grooming'),
  ('Photography & Video', 'photography-video'),
  ('Design & Creative', 'design-creative'),
  ('Development & Tech', 'development-tech'),
  ('Tutoring & Academic Support', 'tutoring-academic-support'),
  ('Writing & Editing', 'writing-editing'),
  ('Repairs & Technical Support', 'repairs-technical-support'),
  ('Fashion & Tailoring', 'fashion-tailoring'),
  ('Events & Entertainment', 'events-entertainment'),
  ('Business & Marketing', 'business-marketing')
ON CONFLICT (slug) DO NOTHING;
