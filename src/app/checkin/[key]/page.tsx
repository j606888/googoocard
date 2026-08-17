"use client";

import { useParams } from "next/navigation";
import PublicCheckin from "@/features/checkin/PublicCheckin";

// Landing page for the QR code posted on the studio wall. Public by design (see
// the `/checkin/` entry in src/middleware.ts) — the classroom key in the URL is
// the only credential.
const PublicCheckinPage = () => {
  const { key } = useParams();

  return (
    <div className="mx-auto min-h-screen w-full max-w-[480px] bg-white">
      <PublicCheckin checkinKey={key as string} />
    </div>
  );
};

export default PublicCheckinPage;
