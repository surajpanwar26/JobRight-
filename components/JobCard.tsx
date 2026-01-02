import React from 'react';
import { Job } from '../types';
import { MapPin, Building2, Clock, DollarSign, Briefcase } from 'lucide-react';

interface JobCardProps {
  job: Job;
}

const JobCard: React.FC<JobCardProps> = ({ job }) => {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg">
            {job.company.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 leading-tight group-hover:text-brand-600 transition-colors">
              {job.title}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            job.matchScore > 85 ? 'bg-green-100 text-green-700' : 
            job.matchScore > 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {job.matchScore}% Match
          </span>
          <span className="text-xs text-gray-400 mt-1">{job.postedAt}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-y-2 gap-x-4 mb-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <MapPin size={14} className="text-gray-400" />
          {job.location}
        </div>
        <div className="flex items-center gap-1">
          <DollarSign size={14} className="text-gray-400" />
          {job.salary || 'Competitive'}
        </div>
        <div className="flex items-center gap-1">
          <Briefcase size={14} className="text-gray-400" />
          {job.type}
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        {job.description}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex gap-2">
          {job.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-md border border-gray-100">
              {tag}
            </span>
          ))}
          {job.tags.length > 2 && (
             <span className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-md border border-gray-100">
             +{job.tags.length - 2}
           </span>
          )}
        </div>
        <button className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
          View Details
        </button>
      </div>
    </div>
  );
};

export default JobCard;