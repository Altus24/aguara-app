import { createClient } from "@/lib/supabase";

export async function uploadPatientPhoto(file: File) {
  const supabase = createClient();
  const extension =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from("patient-photos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(friendlyStorageError(error.message));
  }

  const { data } = supabase.storage.from("patient-photos").getPublicUrl(path);
  return data.publicUrl;
}

function friendlyStorageError(message: string) {
  if (/bucket not found/i.test(message)) {
    return "No existe el bucket patient-photos. Ejecutá supabase/schema.sql en Supabase.";
  }
  if (/row-level security|not authorized|unauthorized/i.test(message)) {
    return "Supabase bloqueó la foto. Ejecutá las políticas de supabase/schema.sql.";
  }
  return "No se pudo subir la foto. Probá de nuevo.";
}
