export interface DemoReward {
  name: string;
  description: string;
  price: number;
  stock: number;
  active: boolean;
}

export const DEMO_REWARDS: readonly DemoReward[] = [
  {
    name: 'Caderno personalizado',
    description: 'Caderno universitário com a capa do Nivela.',
    price: 120,
    stock: 15,
    active: true,
  },
  {
    name: 'Kit marca-texto',
    description: 'Quatro marca-textos em cores diferentes.',
    price: 80,
    stock: 20,
    active: true,
  },
  {
    name: 'Vale-lanche da cantina',
    description: 'Um lanche à escolha na cantina da escola.',
    price: 60,
    stock: 25,
    active: true,
  },
  {
    name: 'Adesivos do Rabisco',
    description: 'Cartela de adesivos do mascote Rabisco.',
    price: 30,
    stock: 40,
    active: true,
  },
  {
    name: '15 minutos de leitura livre',
    description:
      'Quinze minutos de leitura livre na biblioteca durante a aula.',
    price: 40,
    stock: 30,
    active: true,
  },
  {
    name: 'Camiseta do Nivela',
    description: 'Camiseta da turma (esgotada e fora da loja).',
    price: 300,
    stock: 0,
    active: false,
  },
];
