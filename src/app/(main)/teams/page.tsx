"use client";

import TeamList from "@/features/teams/TeamList";
import Navbar from "@/features/Navbar";
import LineBindButton from "@/features/line/LineBindButton";

const TeamsPage = () => {
  return (
    <>
      <Navbar />
      <div className="px-4 pt-4">
        <LineBindButton />
      </div>
      <TeamList />
    </>
  );
};

export default TeamsPage;