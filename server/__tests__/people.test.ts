import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { writeFileSync, existsSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import os from "os";

// Minimal app mirroring server people endpoints
function createApp(peopleFile: string) {
  const app = express();
  app.use(express.json());

  interface Person {
    id: string;
    name: string;
    role?: string;
    notes?: string;
    source: "manual" | "pocket" | "inferred";
    createdAt: string;
  }

  function readPeople(): Person[] {
    try {
      if (existsSync(peopleFile)) {
        const data = JSON.parse(require("fs").readFileSync(peopleFile, "utf-8"));
        return data.people || [];
      }
    } catch {}
    return [];
  }

  function writePeople(people: Person[]) {
    writeFileSync(peopleFile, JSON.stringify({ people }, null, 2) + "\n");
  }

  app.get("/api/people", (_req, res) => {
    res.json({ people: readPeople() });
  });

  app.post("/api/people", (req, res) => {
    const { name, role, notes } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const people = readPeople();
    if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      res.status(409).json({ error: "Person already exists" });
      return;
    }
    const person: Person = {
      id: randomUUID(),
      name: name.trim(),
      role: role?.trim() || undefined,
      notes: notes?.trim() || undefined,
      source: "manual",
      createdAt: new Date().toISOString(),
    };
    people.push(person);
    writePeople(people);
    res.status(201).json(person);
  });

  app.put("/api/people/:id", (req, res) => {
    const people = readPeople();
    const idx = people.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { name, role, notes } = req.body;
    if (name) people[idx].name = name.trim();
    if (role !== undefined) people[idx].role = role?.trim() || undefined;
    if (notes !== undefined) people[idx].notes = notes?.trim() || undefined;
    writePeople(people);
    res.json(people[idx]);
  });

  app.delete("/api/people/:id", (req, res) => {
    const people = readPeople();
    const filtered = people.filter((p) => p.id !== req.params.id);
    if (filtered.length === people.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    writePeople(filtered);
    res.json({ ok: true });
  });

  return app;
}

describe("People API", () => {
  let app: ReturnType<typeof createApp>;
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `seam-test-people-${Date.now()}.json`);
    writeFileSync(tmpFile, JSON.stringify({ people: [] }));
    app = createApp(tmpFile);
  });

  afterEach(() => {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  });

  it("GET /api/people returns empty list initially", async () => {
    const res = await request(app).get("/api/people");
    expect(res.status).toBe(200);
    expect(res.body.people).toEqual([]);
  });

  it("POST /api/people creates a person", async () => {
    const res = await request(app).post("/api/people").send({ name: "Alice", role: "Engineer" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Alice");
    expect(res.body.role).toBe("Engineer");
    expect(res.body.source).toBe("manual");
    expect(res.body.id).toBeDefined();
  });

  it("POST /api/people rejects duplicates (case-insensitive)", async () => {
    await request(app).post("/api/people").send({ name: "Alice" });
    const res = await request(app).post("/api/people").send({ name: "alice" });
    expect(res.status).toBe(409);
  });

  it("POST /api/people rejects missing name", async () => {
    const res = await request(app).post("/api/people").send({});
    expect(res.status).toBe(400);
  });

  it("PUT /api/people/:id updates a person", async () => {
    const create = await request(app).post("/api/people").send({ name: "Bob" });
    const id = create.body.id;

    const res = await request(app).put(`/api/people/${id}`).send({ name: "Robert", role: "Lead" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Robert");
    expect(res.body.role).toBe("Lead");
  });

  it("PUT /api/people/:id returns 404 for unknown id", async () => {
    const res = await request(app).put("/api/people/nonexistent").send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/people/:id removes a person", async () => {
    const create = await request(app).post("/api/people").send({ name: "Carol" });
    const id = create.body.id;

    const del = await request(app).delete(`/api/people/${id}`);
    expect(del.status).toBe(200);

    const list = await request(app).get("/api/people");
    expect(list.body.people).toHaveLength(0);
  });

  it("DELETE /api/people/:id returns 404 for unknown id", async () => {
    const res = await request(app).delete("/api/people/nonexistent");
    expect(res.status).toBe(404);
  });

  it("persists data across reads", async () => {
    await request(app).post("/api/people").send({ name: "Dave" });
    await request(app).post("/api/people").send({ name: "Eve" });

    const res = await request(app).get("/api/people");
    expect(res.body.people).toHaveLength(2);
    expect(res.body.people.map((p: any) => p.name)).toEqual(["Dave", "Eve"]);
  });
});
