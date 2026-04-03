  -- ============================================================
  -- MIGRACIÓN: Auto-creación de profile para usuarios OAuth (Google)
  -- Cuando un usuario se registra vía Google, se crea automáticamente
  -- un profile con rol 'alumno' en el gym por defecto.
  -- El trigger handle_user_role_sync (ya existente) sincronizará
  -- ese rol al JWT (raw_app_metadata) automáticamente.
  -- ============================================================

  -- Función que se ejecuta al crear un nuevo auth.user
  CREATE OR REPLACE FUNCTION public.handle_new_oauth_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_gym_id  UUID;
    v_name    TEXT;
  BEGIN
    -- Solo actuar si NO tiene profile ya (evitar duplicados)
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Solo actuar en signup OAuth (provider != 'email')
    -- NEW.raw_app_metadata->>'provider' es 'google', 'github', etc.
    IF (NEW.raw_app_metadata->>'provider') = 'email' THEN
      RETURN NEW;
    END IF;

    -- Gym por defecto (TechFitness Demo)
    -- Cuando en producción se soporte multi-tenant, este valor
    -- vendrá del estado de invitación o parámetro de la URL.
    v_gym_id := 'c0a80121-7ac0-4e3b-b461-7509f6b64b15';

    -- Nombre: usar display_name de Google, o el email como fallback
    v_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    );

    -- Insertar profile con rol 'alumno' por defecto
    INSERT INTO public.profiles (id, gym_id, full_name, avatar_url, role)
    VALUES (
      NEW.id,
      v_gym_id,
      v_name,
      NEW.raw_user_meta_data->>'avatar_url',
      'alumno'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Nota: el trigger on_profile_update_sync_role en profiles
    -- se disparará automáticamente y seteará raw_app_metadata
    -- con role='alumno' y gym_id en el JWT del usuario.

    RETURN NEW;
  END;
  $$;

  -- Registrar el trigger en auth.users
  DROP TRIGGER IF EXISTS on_auth_user_created_oauth ON auth.users;

  CREATE TRIGGER on_auth_user_created_oauth
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_oauth_user();
