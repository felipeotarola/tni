INSERT INTO number_ranges(prefix, original_operator) VALUES
  ('0700', 'Telia Sverige AB'),
  ('0701', 'Tele2 Sverige AB'),
  ('0702', 'Tele2 Sverige AB'),
  ('0703', 'Hi3G Access AB'),
  ('0704', 'Telenor Sverige AB'),
  ('0720', 'Tele2 Sverige AB'),
  ('0722', 'Hi3G Access AB'),
  ('0727', 'Telenor Sverige AB'),
  ('0730', 'Telia Sverige AB'),
  ('0735', 'Telenor Sverige AB'),
  ('0738', 'Hi3G Access AB'),
  ('0760', 'Telenor Sverige AB'),
  ('0762', 'Tele2 Sverige AB'),
  ('0766', 'Hi3G Access AB'),
  ('0790', 'Tele2 Sverige AB'),
  ('0795', 'Telenor Sverige AB')
ON CONFLICT(prefix) DO UPDATE SET
  original_operator = excluded.original_operator;

