"use client";

import { useGetTeachersQuery } from "@/store/slices/teachers";

const TeachersPage = () => {
  const { data: teachers, isLoading } = useGetTeachersQuery();

  if (isLoading) return <div>Loading...</div>;

  return <div>
    {teachers?.map((teacher) => {
      return (
        <div key={teacher.id}>{teacher.name}</div>
      )
    })}
  </div>;
};

export default TeachersPage;