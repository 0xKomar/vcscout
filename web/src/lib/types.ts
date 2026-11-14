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

export type FactKind =
  | 'role'
  | 'education'
  | 'board'
  | 'advisor'
  | 'angel'
  | 'program'
  | 'coinvestor'
  | 'deal'

export type Certainty = 'fact' | 'inferred'
export type EvidenceOrigin = 'cala-graph' | 'cala' | 'openai'
export interface SourceEvidence {
  url: string
  origin: EvidenceOrigin
}

export interface Fact {
  kind: FactKind
  organization: string
  role: string
  start: string | null
  end: string | null
  source_url: string
  person?: string
  company?: string
  certainty?: Certainty
  origin?: EvidenceOrigin
  sources?: SourceEvidence[]
}

export interface MeEmployer {
  organization: string
  start: string
  end: string
}

export interface MeContact {
  name: string
  organization: string
  ref?: { id: string; identity: string; profile_key?: string }
}

export interface ManualPerson {
  name: string
  profile_url: string
  target?: boolean
}

export interface MeInput {
  name: string
  linkedin_url: string
  employers: MeEmployer[]
  schools: string[]
  contacts: MeContact[]
}

export interface MeProfile extends MeInput {
  facts: Fact[]
  hidden: string[]
  manual_people?: ManualPerson[]
}

export interface MeResponse {
  facts: Fact[]
  origin: 'cache' | 'cala'
}

export interface Dossier {
  name: string
  fund: string
  facts: Fact[]
  origin: 'saved' | 'cache' | 'cala'
  failed?: string[]
}

export type ConnectionRelationship =
  | 'co-founder'
  | 'colleague'
  | 'investor'
  | 'portfolio-founder'
  | 'board'
  | 'classmate'
  | 'teammate'
  | 'co-author'
  | 'co-appearance'
  | 'advisor'
  | 'other'

export type ViaType = 'company' | 'fund' | 'school' | 'event' | 'media' | 'other'

export interface Connection {
  name: string
  role: string
  organization: string
  via: string
  via_type: ViaType
  relationship: ConnectionRelationship
  context: string
  date: string | null
  source_url: string
  profile_url?: string
  certainty?: Certainty
  origin?: EvidenceOrigin
  sources?: SourceEvidence[]
}

export type OrgRelationship =
  | 'founder'
  | 'executive'
  | 'employee'
  | 'investor'
  | 'board'
  | 'advisor'
  | 'organizer'
  | 'jury'
  | 'mentor'
  | 'speaker'
  | 'participant'
  | 'alumni'
  | 'other'

export interface OrgPerson {
  name: string
  role: string
  relationship: OrgRelationship
  affiliation: string
  start: string | null
  end: string | null
  source_url: string
  profile_url?: string
  certainty?: Certainty
  origin?: EvidenceOrigin
  sources?: SourceEvidence[]
}

export interface ResolvedEntity {
  id: string
  name: string
  entity_type: string
}

export type NetworkExpansion =
  | {
      kind: 'person'
      name: string
      entity: ResolvedEntity | null
      connections: Connection[]
      facts: Fact[]
      origin: 'cache' | 'cala' | 'graph' | 'openai'
      failed: string[]
    }
  | {
      kind: 'org'
      name: string
      entity: ResolvedEntity | null
      people: OrgPerson[]
      origin: 'cache' | 'cala' | 'graph' | 'openai'
      failed: string[]
    }

export interface LinkedinConnection {
  name: string
  company: string
  position: string
  url: string
}

export interface RankCandidate {
  id: string
  label: string
  kind: 'person' | 'org'
  sublabel?: string
  links: string[]
}
