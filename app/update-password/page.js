import dynamic from "next/dynamic";

const UpdatePasswordPageClient = dynamic(
  () => import("./UpdatePasswordPageClient"),
  { ssr: false } // disable server-side rendering
);

export default function Page() {
  return <UpdatePasswordPageClient />;
}
