import { IdCard, BookOpenText, Users, Snail } from 'lucide-react'
import Link from 'next/link'

const FEATURES = [
  {
    icon: IdCard,
    title: 'Cards',
    description: 'Sell card to students at no time',
  },
  {
    icon: BookOpenText,
    title: 'Lessons',
    description: 'Check the lesson anytime',
  },
  {
    icon: Users,
    title: 'Students',
    description: 'Understand all the details',
  }
]
export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center left-0 right-0 top-0 bottom-0 absolute bg-primary-50">
      <div className="flex flex-col items-center justify-center h-full">
        <div className="flex justify-center items-center w-32 h-32 bg-primary-500 rounded-full shadow-lg mb-4 mt-8">
          <Snail className="w-12 h-12" color="#fff" />
        </div>
        <h1 className="text-3xl font-bold text-black">Googoo Card</h1>
        <p className="text-base text-gray-500 mb-8">
          Make your lesson easier
        </p>
        <div className="flex flex-col gap-4 items-start mb-8">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex items-center justify-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 bg-[#D4EDE4] rounded-full">
                <feature.icon className="w-6 h-6" color="var(--color-primary-500)" />
              </div>
              <div className="flex flex-col ">
                <h2 className="text-lg font-bold text-black">{feature.title}</h2>
                <p className="text-sm text-gray-500 text-center">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 py-6 w-full">
        <Link href="/signup">
          <button className="bg-primary-500 w-full text-white px-4 py-3 rounded-md font-bold text-lg">
            Sign up
          </button>
        </Link>
        <Link href="/login">
          <button className="border-1 border-primary-500 bg-white w-full text-primary-500 px-4 py-3 rounded-md font-bold text-lg">
          Login
          </button>
        </Link>
      </div>
    </main>
  );
}
