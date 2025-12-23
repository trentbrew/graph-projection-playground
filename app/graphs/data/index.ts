import React from 'react';
import techStack from './tech-stack.json';
import projectManagement from './project-management.json';
import { ProjectDashboard } from '../components/bespoke/ProjectDashboard';
import socialNetwork from './social-network.json';
import eCommerce from './e-commerce.json';
import academicResearch from './academic-research.json';
import orgHierarchy from './org-hierarchy.json';
import semanticCodebase from './semantic-codebase.json';
import musicTheory from './music-theory.json';
import financePortfolio from './finance-portfolio.json';
import systemsArchitecture from './systems-architecture.json';
import triReporting from './tri-reporting.json';

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  data: any;
  bespokeProjection?: React.ComponentType<{
    data: { nodes: any[]; edges: any[] };
  }>;
}

export const sampleDatasets: SampleDataset[] = [
  {
    id: 'tech-stack',
    name: 'Tech Stack',
    description: 'Software architecture and technology dependencies',
    data: techStack,
  },
  {
    id: 'project-management',
    name: 'Project Management',
    description: 'Tasks, sprints, milestones, and team collaboration',
    data: projectManagement,
    bespokeProjection: ProjectDashboard,
  },
  {
    id: 'social-network',
    name: 'Social Network',
    description: 'People, relationships, interests, and group memberships',
    data: socialNetwork,
  },
  {
    id: 'e-commerce',
    name: 'E-Commerce',
    description: 'Products, categories, manufacturers, and relationships',
    data: eCommerce,
  },
  {
    id: 'academic-research',
    name: 'Academic Research',
    description: 'Papers, authors, citations, and research institutions',
    data: academicResearch,
  },
  {
    id: 'org-hierarchy',
    name: 'Org Hierarchy',
    description: 'Company structure, departments, and reporting relationships',
    data: orgHierarchy,
  },
  {
    id: 'semantic-codebase',
    name: 'Semantic Codebase',
    description:
      'Hypermedia-first architecture with modules, classes, and functions',
    data: semanticCodebase,
  },
  {
    id: 'music-theory',
    name: 'Music Theory',
    description: 'Scales, chords, notes, intervals, and progressions',
    data: musicTheory,
  },
  {
    id: 'finance-portfolio',
    name: 'Finance Portfolio',
    description:
      'Investment portfolio with positions, sectors, and correlations',
    data: financePortfolio,
  },
  {
    id: 'systems-architecture',
    name: 'Systems Architecture',
    description:
      'Microservices architecture with services, databases, and infrastructure',
    data: systemsArchitecture,
  },
  {
    id: 'tri-reporting',
    name: 'TRI Reporting',
    description: 'EPA Toxics Release Inventory data for Nucor steel facilities',
    data: triReporting,
  },
];

export const defaultDataset = sampleDatasets[0];
