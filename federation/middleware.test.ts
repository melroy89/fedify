import { lookupObject } from "@fedify/fedify/vocab";
import { Temporal } from "@js-temporal/polyfill";
import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { dirname, join } from "@std/path";
import * as mf from "mock_fetch";
import { sign, verify } from "../httpsig/mod.ts";
import {
  FetchError,
  getAuthenticatedDocumentLoader,
} from "../runtime/docloader.ts";
import { mockDocumentLoader } from "../testing/docloader.ts";
import {
  privateKey2,
  privateKey3,
  publicKey2,
  publicKey3,
} from "../testing/keys.ts";
import { Create, Note, Person } from "../vocab/vocab.ts";
import type { Context } from "./context.ts";
import { MemoryKvStore } from "./kv.ts";
import { Federation } from "./middleware.ts";
import { RouterError } from "./router.ts";

Deno.test("Federation.createContext()", async (t) => {
  const kv = new MemoryKvStore();
  const documentLoader = (url: string) => {
    throw new FetchError(new URL(url), "Not found");
  };

  mf.install();

  mf.mock("GET@/object", async (req) => {
    const v = await verify(req, mockDocumentLoader, Temporal.Now.instant());
    return new Response(JSON.stringify(v != null), {
      headers: { "Content-Type": "application/json" },
    });
  });

  await t.step("Context", async () => {
    const federation = new Federation<number>({ kv, documentLoader });
    const ctx = federation.createContext(new URL("https://example.com/"), 123);
    assertEquals(ctx.data, 123);
    assertStrictEquals(ctx.documentLoader, documentLoader);
    assertThrows(() => ctx.getNodeInfoUri(), RouterError);
    assertThrows(() => ctx.getActorUri("handle"), RouterError);
    assertThrows(
      () => ctx.getObjectUri(Note, { handle: "handle", id: "id" }),
      RouterError,
    );
    assertThrows(() => ctx.getInboxUri(), RouterError);
    assertThrows(() => ctx.getInboxUri("handle"), RouterError);
    assertThrows(() => ctx.getOutboxUri("handle"), RouterError);
    assertThrows(() => ctx.getFollowingUri("handle"), RouterError);
    assertThrows(() => ctx.getFollowersUri("handle"), RouterError);
    assertEquals(
      ctx.getHandleFromActorUri(new URL("https://example.com/")),
      null,
    );
    assertEquals(await ctx.getActorKey("handle"), null);
    assertRejects(
      () => ctx.getDocumentLoader({ handle: "handle" }),
      Error,
      "No actor key pair dispatcher registered",
    );
    assertRejects(
      () => ctx.sendActivity({ handle: "handle" }, [], new Create({})),
      Error,
      "No actor key pair dispatcher registered",
    );

    federation.setNodeInfoDispatcher("/nodeinfo/2.1", () => ({
      software: {
        name: "Example",
        version: { major: 1, minor: 2, patch: 3 },
      },
      protocols: ["activitypub"],
      usage: {
        users: {},
        localPosts: 123,
        localComments: 456,
      },
    }));
    assertEquals(
      ctx.getNodeInfoUri(),
      new URL("https://example.com/nodeinfo/2.1"),
    );

    federation
      .setActorDispatcher("/users/{handle}", () => new Person({}))
      .setKeyPairDispatcher(() => ({
        privateKey: privateKey2,
        publicKey: publicKey2.publicKey!,
      }));
    assertEquals(
      ctx.getActorUri("handle"),
      new URL("https://example.com/users/handle"),
    );
    assertEquals(
      ctx.getHandleFromActorUri(new URL("https://example.com/")),
      null,
    );
    assertEquals(
      ctx.getHandleFromActorUri(new URL("https://example.com/users/handle")),
      "handle",
    );
    assertEquals(
      await ctx.getActorKey("handle"),
      publicKey2.clone({
        id: new URL("https://example.com/users/handle#main-key"),
        owner: new URL("https://example.com/users/handle"),
      }),
    );
    const loader = await ctx.getDocumentLoader({ handle: "handle" });
    assertEquals(await loader("https://example.com/object"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: true,
    });
    const loader2 = ctx.getDocumentLoader({
      keyId: new URL("https://example.com/key2"),
      privateKey: privateKey2,
    });
    assertEquals(await loader2("https://example.com/object"), {
      contextUrl: null,
      documentUrl: "https://example.com/object",
      document: true,
    });
    assertRejects(
      () => ctx.sendActivity({ handle: "handle" }, [], new Create({})),
      TypeError,
      "The activity to send must have at least one actor property.",
    );
    await ctx.sendActivity(
      { handle: "handle" },
      [],
      new Create({
        actor: new URL("https://example.com/users/handle"),
      }),
    );

    federation.setObjectDispatcher(
      Note,
      "/users/{handle}/notes/{id}",
      (_ctx, values) => {
        return new Note({
          summary: `Note ${values.id} by ${values.handle}`,
        });
      },
    );
    assertEquals(
      ctx.getObjectUri(Note, { handle: "john", id: "123" }),
      new URL("https://example.com/users/john/notes/123"),
    );

    federation.setInboxListeners("/users/{handle}/inbox", "/inbox");
    assertEquals(ctx.getInboxUri(), new URL("https://example.com/inbox"));
    assertEquals(
      ctx.getInboxUri("handle"),
      new URL("https://example.com/users/handle/inbox"),
    );

    federation.setOutboxDispatcher(
      "/users/{handle}/outbox",
      () => ({ items: [] }),
    );
    assertEquals(
      ctx.getOutboxUri("handle"),
      new URL("https://example.com/users/handle/outbox"),
    );

    federation.setFollowingDispatcher(
      "/users/{handle}/following",
      () => ({ items: [] }),
    );
    assertEquals(
      ctx.getFollowingUri("handle"),
      new URL("https://example.com/users/handle/following"),
    );

    federation.setFollowersDispatcher(
      "/users/{handle}/followers",
      () => ({ items: [] }),
    );
    assertEquals(
      ctx.getFollowersUri("handle"),
      new URL("https://example.com/users/handle/followers"),
    );
  });

  await t.step("RequestContext", async () => {
    const federation = new Federation<number>({
      kv,
      documentLoader: mockDocumentLoader,
    });
    const req = new Request("https://example.com/");
    const ctx = federation.createContext(req, 123);
    assertEquals(ctx.request, req);
    assertEquals(ctx.url, new URL("https://example.com/"));
    assertEquals(ctx.data, 123);
    assertRejects(
      () => ctx.getActor("someone"),
      Error,
    );
    assertRejects(
      () => ctx.getObject(Note, { handle: "someone", id: "123" }),
      Error,
    );
    assertEquals(await ctx.getSignedKey(), null);
    assertEquals(await ctx.getSignedKeyOwner(), null);
    // Multiple calls should return the same result:
    assertEquals(await ctx.getSignedKey(), null);
    assertEquals(await ctx.getSignedKeyOwner(), null);
    assertRejects(
      () => ctx.getActor("someone"),
      Error,
      "No actor dispatcher registered",
    );

    const signedReq = await sign(
      new Request("https://example.com/"),
      privateKey2,
      publicKey2.id!,
    );
    const signedCtx = federation.createContext(signedReq, 456);
    assertEquals(signedCtx.request, signedReq);
    assertEquals(signedCtx.url, new URL("https://example.com/"));
    assertEquals(signedCtx.data, 456);
    assertEquals(await signedCtx.getSignedKey(), publicKey2);
    assertEquals(await signedCtx.getSignedKeyOwner(), null);
    // Multiple calls should return the same result:
    assertEquals(await signedCtx.getSignedKey(), publicKey2);
    assertEquals(await signedCtx.getSignedKeyOwner(), null);

    const signedReq2 = await sign(
      new Request("https://example.com/"),
      privateKey3,
      publicKey3.id!,
    );
    const signedCtx2 = federation.createContext(signedReq2, 456);
    assertEquals(signedCtx2.request, signedReq2);
    assertEquals(signedCtx2.url, new URL("https://example.com/"));
    assertEquals(signedCtx2.data, 456);
    assertEquals(await signedCtx2.getSignedKey(), publicKey3);
    const expectedOwner = await lookupObject(
      "https://example.com/person2",
      { documentLoader: mockDocumentLoader },
    );
    assertEquals(await signedCtx2.getSignedKeyOwner(), expectedOwner);
    // Multiple calls should return the same result:
    assertEquals(await signedCtx2.getSignedKey(), publicKey3);
    assertEquals(await signedCtx2.getSignedKeyOwner(), expectedOwner);

    federation.setActorDispatcher(
      "/users/{handle}",
      (_ctx, handle) => new Person({ preferredUsername: handle }),
    );
    const ctx2 = federation.createContext(req, 789);
    assertEquals(ctx2.request, req);
    assertEquals(ctx2.url, new URL("https://example.com/"));
    assertEquals(ctx2.data, 789);
    assertEquals(
      await ctx2.getActor("john"),
      new Person({ preferredUsername: "john" }),
    );

    federation.setObjectDispatcher(
      Note,
      "/users/{handle}/notes/{id}",
      (_ctx, values) => {
        return new Note({
          summary: `Note ${values.id} by ${values.handle}`,
        });
      },
    );
    const ctx3 = federation.createContext(req, 123);
    assertEquals(ctx3.request, req);
    assertEquals(ctx3.url, new URL("https://example.com/"));
    assertEquals(ctx3.data, 123);
    assertEquals(
      await ctx2.getObject(Note, { handle: "john", id: "123" }),
      new Note({ summary: "Note 123 by john" }),
    );
  });

  mf.uninstall();
});

Deno.test("Federation.setInboxListeners()", async (t) => {
  const kv = new MemoryKvStore();

  mf.install();

  mf.mock("GET@/key2", async () => {
    return new Response(
      JSON.stringify(
        await publicKey2.toJsonLd({ documentLoader: mockDocumentLoader }),
      ),
      { headers: { "Content-Type": "application/activity+json" } },
    );
  });

  mf.mock("GET@/person", async () => {
    return new Response(
      await Deno.readFile(
        join(
          dirname(import.meta.dirname!),
          "testing",
          "fixtures",
          "example.com",
          "person",
        ),
      ),
      { headers: { "Content-Type": "application/activity+json" } },
    );
  });

  await t.step("on()", async () => {
    const authenticatedRequests: [string, string][] = [];
    const federation = new Federation<void>({
      kv,
      documentLoader: mockDocumentLoader,
      authenticatedDocumentLoaderFactory(identity) {
        const docLoader = getAuthenticatedDocumentLoader(identity);
        return (url: string) => {
          const urlObj = new URL(url);
          authenticatedRequests.push([url, identity.keyId.href]);
          if (urlObj.host === "example.com") return docLoader(url);
          return mockDocumentLoader(url);
        };
      },
    });
    const inbox: [Context<void>, Create][] = [];
    federation.setInboxListeners("/users/{handle}/inbox", "/inbox")
      .on(Create, (ctx, create) => {
        inbox.push([ctx, create]);
      });

    let response = await federation.handle(
      new Request("https://example.com/inbox", { method: "POST" }),
      { contextData: undefined },
    );
    assertEquals(inbox, []);
    assertEquals(response.status, 404);

    federation
      .setActorDispatcher(
        "/users/{handle}",
        (_, handle) => handle === "john" ? new Person({}) : null,
      )
      .setKeyPairDispatcher(() => ({
        privateKey: privateKey2,
        publicKey: publicKey2.publicKey!,
      }));
    response = await federation.handle(
      new Request("https://example.com/inbox", { method: "POST" }),
      { contextData: undefined },
    );
    assertEquals(inbox, []);
    assertEquals(response.status, 401);

    response = await federation.handle(
      new Request("https://example.com/users/no-one/inbox", { method: "POST" }),
      { contextData: undefined },
    );
    assertEquals(inbox, []);
    assertEquals(response.status, 404);

    response = await federation.handle(
      new Request("https://example.com/users/john/inbox", { method: "POST" }),
      { contextData: undefined },
    );
    assertEquals(inbox, []);
    assertEquals(response.status, 401);

    const activity = new Create({
      actor: new URL("https://example.com/person"),
    });
    let request = new Request("https://example.com/users/john/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/activity+json" },
      body: JSON.stringify(
        await activity.toJsonLd({ documentLoader: mockDocumentLoader }),
      ),
    });
    request = await sign(
      request,
      privateKey2,
      new URL("https://example.com/key2"),
    );
    response = await federation.handle(request, { contextData: undefined });
    assertEquals(inbox.length, 1);
    assertEquals(inbox[0][1], activity);
    assertEquals(response.status, 202);

    while (authenticatedRequests.length > 0) authenticatedRequests.shift();
    assertEquals(authenticatedRequests, []);
    await inbox[0][0].documentLoader("https://example.com/person");
    assertEquals(authenticatedRequests, [
      ["https://example.com/person", "https://example.com/users/john#main-key"],
    ]);

    inbox.shift();
    request = new Request("https://example.com/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/activity+json" },
      body: JSON.stringify(
        await activity.toJsonLd({ documentLoader: mockDocumentLoader }),
      ),
    });
    request = await sign(
      request,
      privateKey2,
      new URL("https://example.com/key2"),
    );
    response = await federation.handle(request, { contextData: undefined });
    assertEquals(inbox.length, 1);
    assertEquals(inbox[0][1], activity);
    assertEquals(response.status, 202);

    while (authenticatedRequests.length > 0) authenticatedRequests.shift();
    assertEquals(authenticatedRequests, []);
    await inbox[0][0].documentLoader("https://example.com/person");
    assertEquals(authenticatedRequests, []);
  });

  await t.step("onError()", async () => {
    const federation = new Federation<void>({
      kv,
      documentLoader: mockDocumentLoader,
      authenticatedDocumentLoaderFactory(identity) {
        const docLoader = getAuthenticatedDocumentLoader(identity);
        return (url: string) => {
          const urlObj = new URL(url);
          if (urlObj.host === "example.com") return docLoader(url);
          return mockDocumentLoader(url);
        };
      },
    });
    federation
      .setActorDispatcher(
        "/users/{handle}",
        (_, handle) => handle === "john" ? new Person({}) : null,
      )
      .setKeyPairDispatcher(() => ({
        privateKey: privateKey2,
        publicKey: publicKey2.publicKey!,
      }));
    const errors: unknown[] = [];
    federation.setInboxListeners("/users/{handle}/inbox", "/inbox")
      .on(Create, () => {
        throw new Error("test");
      })
      .onError((_, e) => {
        errors.push(e);
      });

    const activity = new Create({
      actor: new URL("https://example.com/person"),
    });
    let request = new Request("https://example.com/users/john/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/activity+json" },
      body: JSON.stringify(
        await activity.toJsonLd({ documentLoader: mockDocumentLoader }),
      ),
    });
    request = await sign(
      request,
      privateKey2,
      new URL("https://example.com/key2"),
    );
    const response = await federation.handle(request, {
      contextData: undefined,
    });
    assertEquals(errors.length, 1);
    assertEquals(errors[0], new Error("test"));
    assertEquals(response.status, 500);
  });

  mf.uninstall();
});
