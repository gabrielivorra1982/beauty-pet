
-- FASE 4: políticas PROVISIONALES sobre el bucket pet-photos (privado).
-- Se endurecen en Fase 6 cuando se active RLS en el resto del modelo.

DROP POLICY IF EXISTS "pet_photos_provisional_read" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_provisional_insert" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_provisional_update" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_provisional_delete" ON storage.objects;

CREATE POLICY "pet_photos_provisional_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'pet-photos');

CREATE POLICY "pet_photos_provisional_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pet-photos');

CREATE POLICY "pet_photos_provisional_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pet-photos')
  WITH CHECK (bucket_id = 'pet-photos');

CREATE POLICY "pet_photos_provisional_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pet-photos');
