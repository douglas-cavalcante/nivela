# Diagrama de classes (domínio)

Entidades do domínio, espelhando os models do `schema.prisma`. O Aluno é o `User` com `role = student`; as demais associações do aluno (tentativas, conclusões, extrato e resgates) partem dele. Os serviços centrais estão em [classes-servicos.md](classes-servicos.md).

![Diagrama de classes (domínio)](classes.png)

```mermaid
classDiagram
  direction TB

  class User {
    +int id
    +string name
    +string email
    +Role role
    +bool active
  }
  class Student {
    <<aluno, role = student>>
  }
  class StudentProfile {
    +int coinsBalance
    +int currentStreak
    +int bestStreak
    +date lastStudyDate
  }
  class Classroom {
    +string name
    +string schoolYear
    +string joinCode
    +bool active
  }
  class Subject {
    +string name
    +string color
    +string icon
  }
  class Category {
    +string name
  }
  class Question {
    +string statement
    +string imagePath
    +Difficulty difficulty
    +string explanation
    +bool active
  }
  class QuestionOption {
    +char letter
    +string text
    +bool isCorrect
  }
  class QuestionAttempt {
    +int attemptNumber
    +bool isCorrect
    +int coinsAwarded
  }
  class LevelingPlan {
    +string title
    +int completionBonus
    +PlanStatus status
  }
  class PlanChapter {
    +string title
    +int position
  }
  class PlanAssignment {
    +date dueDate
  }
  class ChapterCompletion {
    +datetime completedAt
  }
  class PlanCompletion {
    +int bonusAwarded
  }
  class CoinTransaction {
    +int amount
    +CoinReason reason
    +string sourceType
    +int sourceId
  }
  class Reward {
    +string name
    +int price
    +int stock
    +bool active
  }
  class RewardRedemption {
    +int pricePaid
    +RedemptionStatus status
    +string rejectionReason
  }

  User <|-- Student
  Student "1" --> "1" StudentProfile : perfil
  User "1" --> "*" Classroom : professor responsável
  Student "*" -- "*" Classroom : matrícula
  Subject "1" --> "*" Category
  Category "1" --> "*" Question
  Subject "1" --> "*" Question
  User "1" --> "*" Question : autor
  Question "1" *-- "5" QuestionOption
  Student "1" --> "*" QuestionAttempt
  Question "1" --> "*" QuestionAttempt
  QuestionAttempt "*" --> "1" QuestionOption : alternativa escolhida
  QuestionAttempt "*" --> "0..1" PlanChapter : contexto

  User "1" --> "*" LevelingPlan : professor
  Subject "1" --> "*" LevelingPlan
  LevelingPlan "1" *-- "*" PlanChapter
  PlanChapter "*" -- "*" Question : questões do capítulo
  LevelingPlan "1" --> "*" PlanAssignment
  PlanAssignment "*" --> "0..1" Classroom : turma
  PlanAssignment "*" --> "0..1" Student : aluno
  Student "1" --> "*" ChapterCompletion
  PlanChapter "1" --> "*" ChapterCompletion
  Student "1" --> "*" PlanCompletion
  LevelingPlan "1" --> "*" PlanCompletion

  Student "1" --> "*" CoinTransaction : extrato
  User "1" --> "*" Reward : criado por
  Reward "1" --> "*" RewardRedemption
  Student "1" --> "*" RewardRedemption
  User "0..1" --> "*" RewardRedemption : atendido por
```
