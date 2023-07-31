export function isDeploy(): boolean {
  return process.env.YOLM_BOOST_ENV === "deploy";
}
