# Diagrama entidade-relacionamento (DER)

Gerado a partir de `apps/api/prisma/schema.prisma`: as 19 tabelas e as 31 chaves estrangeiras. Os tipos mostrados são os do banco de forma simplificada; `timestamptz` é `TIMESTAMPTZ(3)`. Restrições compostas, CHECKs e índices únicos parciais estão descritos em [architecture.md](../architecture.md).

![Diagrama entidade-relacionamento (DER)](der.png)

```mermaid
erDiagram
  users {
    int id PK
    string name
    string email UK
    string password
    role role
    boolean active
    timestamptz created_at
    timestamptz updated_at
  }
  student_profiles {
    int user_id PK, FK
    int coins_balance
    int current_streak
    int best_streak
    date last_study_date
  }
  access_tokens {
    int id PK
    int user_id FK
    char token_hash UK
    token_channel channel
    timestamptz last_used_at
    timestamptz created_at
  }
  classrooms {
    int id PK
    int teacher_id FK
    string name
    string school_year
    string join_code UK
    boolean active
    timestamptz created_at
    timestamptz updated_at
  }
  classroom_student {
    int classroom_id PK, FK
    int student_id PK, FK
    timestamptz joined_at
  }
  subjects {
    int id PK
    string name
    string color
    string icon
    timestamptz created_at
    timestamptz updated_at
  }
  categories {
    int id PK
    int subject_id FK
    string name
    timestamptz created_at
    timestamptz updated_at
  }
  questions {
    int id PK
    int author_id FK
    int subject_id FK
    int category_id FK
    text statement
    string image_path
    difficulty difficulty
    text explanation
    boolean active
    timestamptz created_at
    timestamptz updated_at
  }
  question_options {
    int id PK
    int question_id FK
    char letter
    text text
    boolean is_correct
  }
  question_attempts {
    int id PK
    int student_id FK
    int question_id FK
    int plan_chapter_id FK
    int selected_option_id FK
    smallint attempt_number
    boolean is_correct
    int coins_awarded
    timestamptz created_at
  }
  coin_transactions {
    int id PK
    int student_id FK
    int amount
    coin_reason reason
    string source_type
    int source_id
    timestamptz created_at
  }
  leveling_plans {
    int id PK
    int teacher_id FK
    int subject_id FK
    string title
    string description
    int completion_bonus
    plan_status status
    timestamptz published_at
    timestamptz created_at
    timestamptz updated_at
  }
  plan_chapters {
    int id PK
    int leveling_plan_id FK
    string title
    int position
  }
  chapter_question {
    int plan_chapter_id PK, FK
    int question_id PK, FK
    int position
  }
  plan_assignments {
    int id PK
    int leveling_plan_id FK
    int classroom_id FK
    int student_id FK
    date due_date
    timestamptz created_at
  }
  chapter_completions {
    int student_id PK, FK
    int plan_chapter_id PK, FK
    timestamptz completed_at
  }
  plan_completions {
    int student_id PK, FK
    int leveling_plan_id PK, FK
    timestamptz completed_at
    int bonus_awarded
  }
  rewards {
    int id PK
    int created_by FK
    string name
    string description
    string image_path
    int price
    int stock
    boolean active
    timestamptz created_at
    timestamptz updated_at
  }
  reward_redemptions {
    int id PK
    int reward_id FK
    int student_id FK
    int handled_by FK
    int price_paid
    redemption_status status
    timestamptz handled_at
    string rejection_reason
    timestamptz created_at
    timestamptz updated_at
  }

  users ||--o| student_profiles : "perfil"
  users ||--o{ access_tokens : "tokens"
  users ||--o{ classrooms : "professor"
  classrooms ||--o{ classroom_student : "matrículas"
  users ||--o{ classroom_student : "aluno"
  subjects ||--o{ categories : "categorias"
  subjects ||--o{ questions : "disciplina"
  categories ||--o{ questions : "categoria"
  users ||--o{ questions : "autor"
  questions ||--|{ question_options : "alternativas"
  users ||--o{ question_attempts : "aluno"
  questions ||--o{ question_attempts : "questão"
  question_options ||--o{ question_attempts : "escolhida"
  plan_chapters |o--o{ question_attempts : "contexto"
  users ||--o{ coin_transactions : "extrato"
  users ||--o{ leveling_plans : "professor"
  subjects ||--o{ leveling_plans : "disciplina"
  leveling_plans ||--o{ plan_chapters : "capítulos"
  plan_chapters ||--o{ chapter_question : "questões"
  questions ||--o{ chapter_question : "em capítulos"
  leveling_plans ||--o{ plan_assignments : "atribuições"
  classrooms |o--o{ plan_assignments : "turma"
  users |o--o{ plan_assignments : "aluno"
  users ||--o{ chapter_completions : "aluno"
  plan_chapters ||--o{ chapter_completions : "capítulo"
  users ||--o{ plan_completions : "aluno"
  leveling_plans ||--o{ plan_completions : "plano"
  users ||--o{ rewards : "criado por"
  rewards ||--o{ reward_redemptions : "resgates"
  users ||--o{ reward_redemptions : "aluno"
  users |o--o{ reward_redemptions : "atendido por"
```
