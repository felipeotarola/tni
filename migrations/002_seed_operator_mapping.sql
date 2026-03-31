INSERT INTO operator_mapping(operator_name, brands_json, network) VALUES
  ('tele2', '["Comviq","Tele2"]', 'Tele2'),
  ('telia', '["Telia","Halebop","Fello"]', 'Telia'),
  ('telenor', '["Telenor","Vimla"]', 'Telenor'),
  ('tre', '["Tre","Hallon"]', 'Tre'),
  ('chilimobil', '["Chilimobil"]', 'Tre'),
  ('mybeat', '["MyBeat"]', 'Telenor'),
  ('unknown', '["unknown"]', 'unknown')
ON CONFLICT(operator_name) DO UPDATE SET
  brands_json = excluded.brands_json,
  network = excluded.network;

