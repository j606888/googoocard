import Sidebar from './Sidebar'
import { useGetClassroomsQuery } from "@/store/slices/classrooms";

const Navbar = () => {
  const { data } = useGetClassroomsQuery();
  const currentClassroom = data?.classrooms.find((classroom) => classroom.id === data.currentClassroomId);

  return <div className='w-full h-15 bg-primary-500 flex items-center px-5 gap-3'>
    <Sidebar />
    <span className='text-white text-xl font-bold'>{currentClassroom?.name}</span>
  </div>;
};

export default Navbar;