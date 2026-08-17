"use client";

import Navbar from "@/features/Navbar";
import CheckinQr from "@/features/checkinQr";

const CheckinQrPage = () => {
  return (
    <>
      <div className="print:hidden">
        <Navbar />
      </div>
      <CheckinQr />
    </>
  );
};

export default CheckinQrPage;
