import { Menu } from 'lucide-react'
const Navbar = () => {
  return <div className='w-full h-15 bg-primary-500 flex items-center px-5 gap-3'>
    <Menu className='w-6 h-6 text-white' />
    <span className='text-white text-xl font-bold'>Bail&apos;more Studio</span>
  </div>;
};

export default Navbar;