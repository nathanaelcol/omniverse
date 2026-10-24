"""Model Omniverse set dressing in Blender and export GLB files.

Blender is Z-up. The glTF exporter turns Z into Three.js Y, and -Y into +Z.
Grounded props sit on Z = 0. Planet, bone, mote and the white-hole ring
stay centered on the origin.
"""

import math
import os
import random

import bmesh
import bpy

OUT = os.environ.get(
    "OMNI_DECO_OUT",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "models"),
)


def boot():
    import addon_utils
    addon_utils.enable("io_scene_gltf2")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(OUT, exist_ok=True)


def wipe():
    if bpy.context.scene.objects:
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for block in list(coll):
            coll.remove(block)


def material(name, color, rough=0.72, metal=0.02, emit=None, strength=0.0, double=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = not double
    bsdf = mat.node_tree.nodes.get("Principled BSDF")

    def put(keys, value):
        for key in keys:
            sock = bsdf.inputs.get(key)
            if sock is not None:
                sock.default_value = value
                return
    put(("Base Color",), (*color, 1))
    put(("Roughness",), rough)
    put(("Metallic",), metal)
    if emit is not None:
        put(("Emission Color", "Emission"), (*emit, 1))
        put(("Emission Strength",), strength)
    return mat


def link(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return obj


def bake(obj):
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def edit(obj, fn):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    fn(bm)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return obj


def cube(name, size, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    return link(obj, mat)


def cylinder(name, radius, depth, loc, mat, vertices=7):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    return link(obj, mat)


def cone(name, r1, r2, depth, loc, mat, vertices=5):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    return link(obj, mat)


def ico(name, radius, loc, mat, subs=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subs, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    return link(obj, mat)


def finish(name):
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not objects:
        raise RuntimeError(f"nothing to export for {name}")
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
    print(f"WROTE {name} {os.path.getsize(path)}")
    wipe()


def build_monolith():
    stone = material("Stone", (0.91, 0.88, 0.82), rough=0.55)
    glow = material("Glow", (0.62, 0.48, 1.0), rough=0.25, emit=(0.55, 0.38, 1.0), strength=3.2)
    obj = cylinder("monolith", 0.72, 4.5, (0, 0, 2.25), stone, vertices=6)
    edit(obj, chip_obelisk)
    cube("glow", (0.05, 0.08, 2.1), (0, -0.62, 2.15), glow)
    cone("glow", 0.14, 0.02, 0.28, (0, 0, 4.48), glow, vertices=4)


def chip_obelisk(bm):
    for vert in bm.verts:
        along = (vert.co.z + 2.25) / 4.5
        vert.co.x *= 1.08 - along * 0.42
        vert.co.y *= 0.9 - along * 0.2
        if along > 0.9:
            vert.co.x *= 0.62
            vert.co.y *= 0.62
    for vert in bm.verts:
        if vert.co.z > 1.35 and vert.co.x < -0.12:
            vert.co.z -= 0.32
            vert.co.x -= 0.1


def build_arch():
    stone = material("Stone", (0.78, 0.72, 0.64), rough=0.78)
    glow = material("Glow", (1, 0.82, 0.55), rough=0.3, emit=(1, 0.75, 0.4), strength=2.4)
    for side in (-1, 1):
        pillar = cylinder("pillar", 0.22, 3.15, (side * 1.32, 0, 1.57), stone, vertices=6)
        edit(pillar, lambda bm, s=side: lean_pillar(bm, s))
        cone("capital", 0.34, 0.16, 0.22, (side * 1.32, 0, 3.22), stone, vertices=6)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.32, minor_radius=0.12,
        major_segments=20, minor_segments=6,
        location=(0, 0, 3.2), rotation=(math.pi / 2, 0, 0),
    )
    ring = bake(bpy.context.active_object)
    ring.name = "lintel"
    edit(ring, drop_lower_arch)
    link(ring, glow)
    cube("glow", (0.28, 0.28, 0.2), (0, 0, 4.42), glow)


def lean_pillar(bm, side):
    for vert in bm.verts:
        along = (vert.co.z + 1.575) / 3.15
        vert.co.x += side * 0.08 * along
        if along < 0.08:
            vert.co.x *= 1.2
            vert.co.y *= 1.35


def drop_lower_arch(bm):
    doomed = [vert for vert in bm.verts if vert.co.z < 2.95]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")


def build_tree():
    trunk_m = material("Trunk", (0.36, 0.24, 0.14), rough=0.86)
    leaf_m = material("Leaf", (0.16, 0.38, 0.18), rough=0.8)
    trunk = cylinder("trunk", 0.62, 8.6, (0, 0, 4.3), trunk_m, vertices=7)
    edit(trunk, lambda bm: taper_and_bend(bm, 0.62, 0.22, 8.6))
    for i, angle in enumerate((0.3, 2.1, 3.9, 5.3)):
        root = cone(
            "root", 0.26, 0.04, 1.45,
            (math.cos(angle) * 0.72, math.sin(angle) * 0.72, 0.42),
            trunk_m, vertices=5,
        )
        root.rotation_euler = (1.05, 0, angle + math.pi / 2)
    lobes = (
        (0.1, 0.0, 8.8, 2.05), (1.55, 0.35, 8.0, 1.4), (-1.35, 0.7, 7.7, 1.45),
        (0.35, -1.45, 8.2, 1.3), (-0.55, -0.85, 9.45, 1.1), (0.95, 1.15, 9.15, 1.05),
    )
    for i, (x, y, z, radius) in enumerate(lobes):
        blob = ico("leaf", radius, (x, y, z), leaf_m, subs=1)
        edit(blob, lambda bm, n=i, amp=radius * 0.16: puff(bm, n, amp))


def taper_and_bend(bm, radius_bottom, radius_top, depth):
    for vert in bm.verts:
        flat = math.hypot(vert.co.x, vert.co.y)
        along = (vert.co.z + depth / 2) / depth
        if flat > 1e-6:
            target = radius_bottom + (radius_top - radius_bottom) * along
            vert.co.x *= target / flat
            vert.co.y *= target / flat
        vert.co.x += math.sin(along * math.pi) * 0.22
        vert.co.y += math.cos(along * 2.2) * 0.08


def puff(bm, seed, amount):
    rng = random.Random(20 + seed)
    for vert in bm.verts:
        vert.co.x += (rng.random() - 0.5) * amount
        vert.co.y += (rng.random() - 0.5) * amount
        vert.co.z += (rng.random() - 0.5) * amount * 0.7


def build_planet():
    body = material("Body", (0.72, 0.32, 0.22), rough=0.62)
    ring_m = material("Ring", (0.93, 0.82, 0.62), rough=0.4, emit=(0.75, 0.5, 0.28), strength=0.4)
    sphere = ico("body", 1, (0, 0, 0), body, subs=2)
    edit(sphere, crater)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.55, minor_radius=0.04,
        major_segments=32, minor_segments=6,
        location=(0, 0, 0), rotation=(1.15, 0.25, 0.45),
    )
    ring = bpy.context.active_object
    ring.name = "ring"
    link(ring, ring_m)


def crater(bm):
    rng = random.Random(4)
    for vert in bm.verts:
        warp = 0.055 * math.sin(vert.co.x * 5.5 + vert.co.y * 2.0)
        warp += 0.04 * math.cos(vert.co.z * 6.5)
        vert.co += vert.co.normalized() * warp
    for index in (3, 17, 40, 70, 110, 150):
        if index >= len(bm.verts):
            continue
        vert = bm.verts[index]
        vert.co -= vert.co.normalized() * (0.1 + rng.random() * 0.08)


def build_crystal():
    glow = material("Glow", (0.72, 0.86, 1.0), rough=0.18, metal=0.08, emit=(0.45, 0.75, 1.0), strength=1.8)
    shards = (
        (0, 0, 1.15, 0.32, 2.3, 0.08),
        (0.36, 0.1, 0.72, 0.16, 1.45, 0.45),
        (-0.3, 0.16, 0.58, 0.13, 1.15, -0.4),
        (0.08, -0.32, 0.82, 0.12, 1.65, 0.7),
    )
    for i, (x, y, z, radius, height, tilt) in enumerate(shards):
        shard = cone(f"shard{i}", radius, 0.015, height, (x, y, z), glow, vertices=4)
        shard.rotation_euler = (tilt, 0.15 * i, 0.2)


def build_bone():
    bone = material("Bone", (0.93, 0.88, 0.78), rough=0.48)
    for i, x in enumerate((-1.05, -0.55, 0.0, 0.55, 1.05)):
        radius = 0.36 if abs(x) > 0.8 else 0.22
        knob = ico("bone", radius, (x, math.sin(x * 1.2) * 0.12, 0.05 * x), bone, subs=1)
        edit(knob, lambda bm, n=i: puff(bm, 30 + n, 0.05))
    shaft = cylinder("shaft", 0.15, 1.6, (0, 0, 0), bone, vertices=6)
    shaft.rotation_euler = (0, math.pi / 2, 0.18)


def build_rock():
    stone = material("Stone", (0.45, 0.4, 0.34), rough=0.9)
    rock = ico("rock", 0.8, (0, 0, 0.52), stone, subs=1)
    edit(rock, settle_rock)


def settle_rock(bm):
    rng = random.Random(9)
    for vert in bm.verts:
        vert.co.x *= 1.4
        vert.co.y *= 0.92
        vert.co.x += (rng.random() - 0.5) * 0.2
        vert.co.y += (rng.random() - 0.5) * 0.16
        vert.co.z += (rng.random() - 0.5) * 0.1
        if vert.co.z < -0.42:
            vert.co.z = -0.52


def build_fern():
    leaf = material("Leaf", (0.25, 0.55, 0.22), rough=0.7, double=True)
    stem_m = material("Trunk", (0.2, 0.35, 0.14), rough=0.8)
    cylinder("stem", 0.03, 0.75, (0, 0, 0.37), stem_m, vertices=4)
    for i, angle in enumerate((0.4, 1.6, 2.9, 4.3, 5.5)):
        frond = cube(
            "leaf", (0.46, 0.12, 0.02),
            (math.cos(angle) * 0.26, math.sin(angle) * 0.26, 0.22 + i * 0.09),
            leaf,
        )
        frond.rotation_euler = (1.05, 0, angle)


def build_ruin():
    stone = material("Stone", (0.62, 0.56, 0.48), rough=0.84)
    glow = material("Glow", (0.85, 0.7, 0.4), rough=0.35, emit=(0.8, 0.55, 0.25), strength=0.9)
    column = cylinder("column", 0.38, 2.15, (0, 0, 1.07), stone, vertices=7)
    edit(column, break_top)
    cube("glow", (0.1, 0.46, 0.08), (0.3, 0, 0.72), glow)
    cube("rubble", (0.72, 0.42, 0.2), (0.58, 0.18, 0.1), stone)


def break_top(bm):
    for vert in bm.verts:
        if vert.co.z > 0.35:
            vert.co.z -= 0.55 * max(0.0, vert.co.x + 0.05)
            vert.co.x *= 0.82


def build_ring():
    glow = material("Glow", (0.95, 0.95, 1.0), rough=0.2, emit=(0.85, 0.9, 1.0), strength=2.8)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.15, minor_radius=0.065,
        major_segments=28, minor_segments=8,
        location=(0, 0, 0), rotation=(0, math.pi / 2, 0),
    )
    ring = bpy.context.active_object
    ring.name = "glow"
    link(ring, glow)
    ico("core", 0.16, (0, 0, 0), glow, subs=1)


def build_shrine():
    stone = material("Stone", (0.7, 0.66, 0.6), rough=0.7)
    glow = material("Glow", (0.9, 0.8, 0.45), rough=0.25, emit=(1, 0.8, 0.4), strength=2.2)
    cylinder("dais", 0.62, 0.12, (0, 0, 0.06), stone, vertices=8)
    cone("glow", 0.14, 0.02, 0.62, (0, 0, 0.44), glow, vertices=5)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.5, minor_radius=0.03,
        major_segments=16, minor_segments=5,
        location=(0, 0, 0.16),
    )
    halo = bpy.context.active_object
    halo.name = "glow"
    link(halo, glow)


def build_coral():
    glow = material("Glow", (1.0, 0.45, 0.62), rough=0.35, emit=(1.0, 0.35, 0.55), strength=1.1)
    stem_m = material("Body", (0.85, 0.35, 0.48), rough=0.55)
    cylinder("stem", 0.07, 0.85, (0, 0, 0.42), stem_m, vertices=5)
    tips = ((0.26, 0.04, 0.82, 0.65), (-0.2, 0.14, 0.68, -0.55), (0.04, -0.24, 0.9, 0.35), (0.14, 0.18, 1.1, 0.15))
    for i, (x, y, z, tilt) in enumerate(tips):
        branch = cone(f"tip{i}", 0.06, 0.012, 0.5, (x, y, z), glow, vertices=4)
        branch.rotation_euler = (tilt, 0.1 * i, i * 0.4)


def build_bell():
    metal = material("Body", (0.78, 0.7, 0.42), rough=0.28, metal=0.65)
    glow = material("Glow", (0.95, 0.85, 0.45), rough=0.2, emit=(0.9, 0.7, 0.25), strength=1.4)
    bell = cone("bell", 0.46, 0.1, 0.72, (0, 0, -0.46), metal, vertices=8)
    edit(bell, flare_bell)
    ico("clapper", 0.07, (0, 0, -0.7), glow, subs=1)
    cylinder("crown", 0.05, 0.14, (0, 0, -0.05), metal, vertices=6)


def flare_bell(bm):
    for vert in bm.verts:
        if vert.co.z < -0.2:
            vert.co.x *= 1.28
            vert.co.y *= 1.28


def build_console():
    stone = material("Stone", (0.55, 0.5, 0.46), rough=0.6)
    glow = material("Glow", (0.55, 0.9, 0.85), rough=0.2, emit=(0.4, 0.95, 0.85), strength=2.0)
    cube("plinth", (1.35, 0.62, 0.78), (0, 0, 0.39), stone)
    panel = cube("glow", (0.82, 0.46, 0.05), (0, -0.18, 0.92), glow)
    panel.rotation_euler = (0.85, 0, 0)
    cylinder("post", 0.045, 0.36, (-0.48, 0.16, 0.95), stone, vertices=5)
    ico("orb", 0.09, (-0.48, 0.16, 1.2), glow, subs=1)


def build_mote():
    glow = material("Glow", (0.95, 0.9, 0.7), rough=0.15, emit=(1, 0.9, 0.55), strength=2.6)
    mote = ico("glow", 0.2, (0, 0, 0), glow, subs=1)
    edit(mote, stretch_mote)


def stretch_mote(bm):
    for vert in bm.verts:
        vert.co.z *= 1.8
        vert.co.x *= 0.72
        vert.co.y *= 0.72


def build_vertebra():
    bone = material("Bone", (0.9, 0.84, 0.72), rough=0.5)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.55, minor_radius=0.15,
        major_segments=10, minor_segments=6,
        location=(0, 0, 0.2),
    )
    ring = bpy.context.active_object
    ring.name = "bone"
    edit(ring, lambda bm: puff(bm, 12, 0.04))
    link(ring, bone)
    spur = cone("spur", 0.12, 0.02, 0.42, (0.72, 0, 0.28), bone, vertices=4)
    spur.rotation_euler = (0, math.pi / 2.4, 0)


def main():
    boot()
    builders = [
        ("monolith", build_monolith),
        ("arch", build_arch),
        ("tree", build_tree),
        ("planet", build_planet),
        ("crystal", build_crystal),
        ("bone", build_bone),
        ("rock", build_rock),
        ("fern", build_fern),
        ("ruin", build_ruin),
        ("ring", build_ring),
        ("shrine", build_shrine),
        ("coral", build_coral),
        ("bell", build_bell),
        ("console", build_console),
        ("mote", build_mote),
        ("vertebra", build_vertebra),
    ]
    for model_name, builder in builders:
        wipe()
        builder()
        finish(model_name)
    print("DECOS_OK", OUT)


if __name__ == "__main__":
    main()
