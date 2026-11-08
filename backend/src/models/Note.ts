import { Schema, model, Document, Types } from 'mongoose'

export interface INote extends Document {
  clientId: string
  patientId: Types.ObjectId
  doctorId: Types.ObjectId
  authorId: string
  authorName: string
  body: string
  createdAt: Date
  updatedAt: Date
}

const NoteSchema = new Schema<INote>(
  {
    clientId: { type: String, required: true, default: () => new Types.ObjectId().toString() },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    body: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret.clientId ?? ret._id
        delete ret._id
        delete ret.__v
      },
    },
  }
)

NoteSchema.index({ doctorId: 1, clientId: 1 }, { unique: true })
NoteSchema.index({ patientId: 1, createdAt: -1 })
NoteSchema.index({ doctorId: 1, updatedAt: -1 })

export const Note = model<INote>('Note', NoteSchema)
