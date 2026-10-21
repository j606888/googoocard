"use client";

import TeamList from "@/features/teams/TeamList";
import Navbar from "@/features/Navbar";
import LineBindButton from "@/features/line/LineBindButton";

const TeamsPage = () => {
  return (
    <>
      <Navbar />
      <div className="w-full max-w-[720px]">
        <div className="px-5 pt-4 lg:px-8 lg:pt-6">
          <LineBindButton />
        </div>
        <TeamList />
      </div>
    </>
  );
};

export default TeamsPage;