import { Pencil } from "lucide-react";

const BasicInformation = () => {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center border-b-1 border-gray-200 pb-2 mb-2">
        <h3 className="text-base font-bold">Basic Information</h3>
        <div className="flex items-center gap-2 text-primary-700">
          <Pencil className="w-5 h-5" />
          <span className="text-sm font-medium">Edit</span>
        </div>
      </div>
      <div className="mb-2">
        <p className="text-sm font-semibold">Lesson name:</p>
        <p>Bachata Lv2</p>
      </div>
      <div className="mb-2">
        <p className="text-sm font-semibold">Teachers:</p>
        <ul className="list-disc list-inside">
          <li>Sean</li>
          <li>Kathy</li>
        </ul>
      </div>
      <div className="mb-2">
        <p className="text-sm font-semibold">Cards:</p>
        <ul className="list-disc list-inside">
          <li>6堂(中階) / 6 sessions / $2000</li>
          <li>單堂(中階) / 1 session / $350</li>
        </ul>
      </div>
    </div>
  );
};

export default BasicInformation;
