import { Schema, model, Document } from 'mongoose'

export interface IHospital extends Document {
  name: string
  city: string
  state: string
  slug: string
  createdAt: Date
}

const HospitalSchema = new Schema<IHospital>(
  {
    name: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
      },
    },
  }
)

export const Hospital = model<IHospital>('Hospital', HospitalSchema)
