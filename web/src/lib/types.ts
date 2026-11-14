export type Stage = 'seed' | 'series-a'

export type TextValue = string | string[] | null | undefined

export interface SimilarMatch {
  company: string
  description: string
  similarity_reason: string
  source_url: string
}

export interface Round {
  round_type?: TextValue
  announcement_date?: TextValue
  lead_investors?: TextValue
  investors?: TextValue
  source_urls?: TextValue
  amount?: TextValue
  currency?: TextValue
  [key: string]: unknown
}

export interface CompanyRounds {
  company: string
  rounds: Round[]
  cached: boolean
}

export interface Partner {
  name: string
  role: string
  connection: string
  source_url: string
}

export type PartnerOrigin = 'saved' | 'cache' | 'cala'

export interface PartnersResponse {
  partners: Partner[]
  origin: PartnerOrigin
}

export interface Risk {
  fund: string
  competitor: string
  reason: string
  source_url: string
}

export interface FundPathsResponse {
  companies: CompanyRounds[]
  origin: 'cala' | 'cache'
}

export type FundStage = 'seed' | 'series-a' | 'series-b'

export interface PersonInvestment {
  company: string
  round_type: string
  announcement_date: string
  person_role: string
  source_url: string
}

export interface PersonInvestmentsResponse {
  investments: PersonInvestment[]
  origin: 'saved' | 'cache' | 'cala'
}

export interface Founder {
  name: string
  role: string
  source_url: string
}

export interface FoundersResponse {
  founders: Founder[]
  origin: 'saved' | 'cache' | 'cala'
}

export type LinkedinKind = 'fund' | 'startup'

export interface LinkedinProfile {
  url: string | null
  evidence: string | null
  photo: string | null
  origin: 'cache' | 'openai'
}

export interface IdeaQuery {
  idea: string
  startupName: string
  stage: Stage
  region: string
  target: string
}

export type Selection =
  | { type: 'fund'; kind: 'early' | 'later'; key: string; company: string; person?: Partner }
  | { type: 'lead'; fund: string; round: Round; company: string; person?: Partner }
