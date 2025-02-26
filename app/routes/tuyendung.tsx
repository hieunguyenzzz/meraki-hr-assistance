import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import axios from "axios";

// Function to fetch emails
async function fetchApplicants(limit = 10, request?: Request) {
  try {
    console.log('Fetching applicants with limit:', limit);
    
    // Construct full URL for server-side requests
    const baseUrl = request 
      ? `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}` 
      : '';
    
    const response = await axios.get(`${baseUrl}/api/emails/imap?limit=${limit}&flagged=true`);
    
    console.log('API Response:', response.data);
    return response.data.emails || [];
  } catch (error) {
    console.error('Error fetching applicants:', error);
    return [];
  }
}

export const meta: MetaFunction = () => {
  return [
    { title: "Tuyển Dụng - Meraki Wedding Planner" },
    { name: "description", content: "Applicant Tracking Dashboard" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Default to 10 emails or get from URL
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);
  
  // Pass request to help construct full URL
  const applicantData = await fetchApplicants(limit, request);

  return json({
    applicants: applicantData,
    limit
  });
}

export default function TuyenDungPage() {
  const { applicants } = useLoaderData<typeof loader>();

  const renderApplicantGrid = () => {
    if (!applicants || applicants.length === 0) {
      return <p className="text-gray-500">No applicants found</p>;
    }

    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Full Name</th>
              <th className="border p-2">Position</th>
              <th className="border p-2">Year of Birth</th>
              <th className="border p-2">Phone</th>
              <th className="border p-2">Email</th>
              <th className="border p-2">Address</th>
              <th className="border p-2">CV</th>
              <th className="border p-2">Portfolio</th>
              <th className="border p-2">Source</th>
              <th className="border p-2">School</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((applicant) => {
              const details = applicant.applicantDetails || {};
              return (
                <tr key={applicant.id} className="hover:bg-gray-100">
                  <td className="border p-2">{details.fullName || 'N/A'}</td>
                  <td className="border p-2">{details.position || 'N/A'}</td>
                  <td className="border p-2">{details.yearOfBirth || 'N/A'}</td>
                  <td className="border p-2">{details.phone || 'N/A'}</td>
                  <td className="border p-2">{details.email || 'N/A'}</td>
                  <td className="border p-2">{details.address || 'N/A'}</td>
                  <td className="border p-2">
                    {details.cvUrl ? (
                      <a 
                        href={details.cvUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-500 hover:underline"
                      >
                        View CV
                      </a>
                    ) : 'N/A'}
                  </td>
                  <td className="border p-2">
                    {details.portfolioUrl ? (
                      <a 
                        href={details.portfolioUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-500 hover:underline"
                      >
                        View Portfolio
                      </a>
                    ) : 'N/A'}
                  </td>
                  <td className="border p-2">{details.source || 'N/A'}</td>
                  <td className="border p-2">{details.school || 'N/A'}</td>
                  <td className="border p-2">
                    <div className="flex space-x-2">
                      <button 
                        className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                        onClick={() => handleReview(applicant)}
                      >
                        Review
                      </button>
                      <button 
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                        onClick={() => handleInterview(applicant)}
                      >
                        Interview
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Placeholder functions for future implementation
  const handleReview = (applicant: any) => {
    console.log('Reviewing applicant:', applicant);
    // TODO: Implement review logic
  };

  const handleInterview = (applicant: any) => {
    console.log('Scheduling interview for:', applicant);
    // TODO: Implement interview scheduling
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tuyển Dụng - Applicant Tracking</h1>
        <div className="flex space-x-2">
          <button 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            onClick={() => {/* TODO: Implement filter logic */}}
          >
            Filter Applicants
          </button>
          <button 
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
            onClick={() => {/* TODO: Implement refresh logic */}}
          >
            Refresh
          </button>
        </div>
      </div>
      
      {renderApplicantGrid()}
    </div>
  );
} 