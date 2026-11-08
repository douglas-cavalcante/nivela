import type { SvgIconComponent } from '@mui/icons-material';
import CategoryIcon from '@mui/icons-material/CategoryOutlined';
import ClassIcon from '@mui/icons-material/GroupsOutlined';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import PlanIcon from '@mui/icons-material/MenuBookOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import QuestionIcon from '@mui/icons-material/HelpOutlineOutlined';
import StoreIcon from '@mui/icons-material/StorefrontOutlined';
import SubjectIcon from '@mui/icons-material/SchoolOutlined';
import TeacherIcon from '@mui/icons-material/BadgeOutlined';
import type { Role } from '@nivela/api-contract';

export interface MenuItem {
  label: string;
  path: string;
  icon: SvgIconComponent;
  roles: Role[];
}

const STAFF: Role[] = ['admin', 'teacher'];

export const menuItems: MenuItem[] = [
  { label: 'Início', path: '/', icon: HomeIcon, roles: STAFF },
  { label: 'Questões', path: '/questoes', icon: QuestionIcon, roles: STAFF },
  { label: 'Planos', path: '/planos', icon: PlanIcon, roles: STAFF },
  { label: 'Disciplinas', path: '/disciplinas', icon: SubjectIcon, roles: STAFF },
  { label: 'Categorias', path: '/categorias', icon: CategoryIcon, roles: STAFF },
  { label: 'Turmas', path: '/turmas', icon: ClassIcon, roles: STAFF },
  { label: 'Alunos', path: '/alunos', icon: PeopleIcon, roles: STAFF },
  { label: 'Loja de prêmios', path: '/loja', icon: StoreIcon, roles: STAFF },
  { label: 'Professores', path: '/professores', icon: TeacherIcon, roles: ['admin'] },
];
