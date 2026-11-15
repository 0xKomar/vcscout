import type {
  CompanyRounds,
  Dossier,
  FundPathsResponse,
  FoundersResponse,
  FundStage,
  LinkedinKind,
  LinkedinProfile,
  MeInput,
  MeResponse,
  NetworkExpansion,
  PartnersResponse,
  PersonInvestmentsResponse,
  RankCandidate,
  Risk,
  SimilarMatch,
} from './types'

const CONNECTION_ERROR =
  'Cannot connect to VCScout. Please try again in a moment.'

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error(CONNECTION_ERROR)
  }
}

function errorMessage(data: unknown): string {
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    return (data as { error: string }).error
  }
  return 'Could not retrieve data.'
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(CONNECTION_ERROR)
  }
  const data = await readJson(response)
  if (!response.ok) throw new Error(errorMessage(data))
  return data as T
}

export function fetchSimilar(idea: string): Promise<{ matches: SimilarMatch[] }> {
  return postJson('/api/similar', { idea })
}

export function fetchCompany(name: string, context = ''): Promise<CompanyRounds> {
  return postJson('/api/search', { name, context })
}

export function fetchPartners(company: string, fund: string): Promise<PartnersResponse> {
  return postJson('/api/partners', { company, fund })
}

export function fetchRisks(idea: string, funds: string[]): Promise<{ risks: Risk[] }> {
  return postJson('/api/risks', { idea, funds })
}

export function fetchFundPaths(fund: string, stage: FundStage, exclude: string[]): Promise<FundPathsResponse> {
  return postJson('/api/fund-paths', { fund, stage, exclude })
}

export function fetchPersonInvestments(
  name: string,
  fund: string,
): Promise<PersonInvestmentsResponse> {
  return postJson('/api/person-investments', { name, fund })
}

export function fetchFounders(company: string, context = ''): Promise<FoundersResponse> {
  return postJson('/api/founders', { company, context })
}

export function fetchLinkedin(
  name: string,
  organization: string,
  kind: LinkedinKind,
): Promise<LinkedinProfile> {
  return postJson(
    '/api/linkedin',
    kind === 'startup' ? { name, company: organization } : { name, fund: organization },
  )
}

export function fetchMe(input: MeInput): Promise<MeResponse> {
  return postJson('/api/me', {
    name: input.name,
    linkedin_url: input.linkedin_url,
    employers: input.employers,
    schools: input.schools,
  })
}

export function fetchDossier(name: string, fund: string): Promise<Dossier> {
  return postJson('/api/dossier', { name, fund })
}

export interface NetworkRequest {
  kind: 'person' | 'org'
  name: string
  context: string
  background?: boolean
  deep?: boolean
  enhance?: boolean
  include_adjacent?: boolean
  known: string[]
  focus?: string[]
  focus_people?: string[]
  identity_orgs?: string[]
  profile_url?: string
  counterpart?: { name: string; context: string }
}

export function fetchNetwork(request: NetworkRequest): Promise<NetworkExpansion> {
  return postJson('/api/network', request)
}

export function fetchRank(request: {
  me: { name: string; context: string }
  targets: { name: string; org: string }[]
  candidates: RankCandidate[]
}): Promise<{ order: string[] }> {
  return postJson('/api/rank', request)
}

export async function fetchExamples(): Promise<{ names: string[] }> {
  let response: Response
  try {
    response = await fetch('/api/examples')
  } catch {
    throw new Error(CONNECTION_ERROR)
  }
  const data = await readJson(response)
  if (!response.ok) throw new Error(errorMessage(data))
  return data as { names: string[] }
}
