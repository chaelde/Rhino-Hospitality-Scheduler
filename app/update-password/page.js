import dynamic from "next/dynamic";

const UpdatePasswordPageClient = dynamic(
  () => import("./UpdatePasswordPageClient"),
  { ssr: false } // client-only
);

export default function Page() {
  return <UpdatePasswordPageClient />;
}
