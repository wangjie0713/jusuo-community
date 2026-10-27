# SPDX-License-Identifier: MPL-2.0
"""Build only the fictional CE apartment. Run with Blender 4.5+ in background.

blender --background --python scripts/create-community-model.py -- --output .local/model-v4
blender --background --python scripts/create-community-model.py -- --output .local/model-v4 --bake
All materials and geometry are authored here. No input models, photos or household data.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--bake', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT = (ROOT / args.output).resolve()
if not OUT.is_relative_to(ROOT):
    raise ValueError('Build output must stay inside this Community Edition project.')
OUT.mkdir(parents=True, exist_ok=True)
random.seed(1926)


def color(value):
    channels = [int(value[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in channels)+(1,)


def material(name, hex_color, rough=.7, metal=0, kind=None):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    bsdf=next(node for node in nodes if node.type=='BSDF_PRINCIPLED');base=color(hex_color)
    bsdf.inputs['Base Color'].default_value=base
    bsdf.inputs['Roughness'].default_value=rough;bsdf.inputs['Metallic'].default_value=metal
    if kind:
        # World position keeps grain scale stable after the bake mesh is joined.
        coord=nodes.new('ShaderNodeNewGeometry')
        scale=nodes.new('ShaderNodeVectorMath');scale.operation='MULTIPLY'
        scale.inputs[1].default_value={'wood':(.9,36,7),'fabric':(145,145,145),'plaster':(95,95,95),'stone':(2,2,2)}[kind]
        links.new(coord.outputs['Position'],scale.inputs[0])
        noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2
        noise.inputs['Detail'].default_value=3;noise.inputs['Roughness'].default_value=.7
        links.new(scale.outputs[0],noise.inputs['Vector'])
        ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[1].position=.82
        contrast=.28 if kind=='wood' else .12
        ramp.color_ramp.elements[0].color=tuple(c*(1-contrast) for c in base[:3])+(1,)
        ramp.color_ramp.elements[1].color=tuple(min(1,c*(1+contrast)) for c in base[:3])+(1,)
        links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs['Color'],bsdf.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.24 if kind=='fabric' else .16
        bump.inputs['Distance'].default_value=.012 if kind=='wood' else .006
        links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
        if kind=='fabric':bsdf.inputs['Sheen Weight'].default_value=.24
    return mat


def xyz(x,y,z):
    """CE coordinates are Y-up; Blender is Z-up; glTF export restores Y-up."""
    return (x,-z,y)


def finish(obj,name,mat):
    obj.name=name;obj.data.materials.append(mat)
    return obj


def box(name,w,h,d,x,y,z,mat,bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(x,y,z));o=bpy.context.object;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,mat)
    if bevel:
        mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=min(bevel,min(w,h,d)*.3);mod.segments=3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for p in o.data.polygons:p.use_smooth=True
        mod=o.modifiers.new('Face normals','WEIGHTED_NORMAL');mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def cylinder(name,r,h,x,y,z,mat,top=None,vertices=32):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if top is None else top,depth=h,location=xyz(x,y,z))
    o=finish(bpy.context.object,name,mat)
    bevel=o.modifiers.new('Turned rim','BEVEL');bevel.width=min(.008,h*.12);bevel.segments=2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in o.data.polygons:p.use_smooth=True
    return o


def curve(name,points,radius,mat):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=10
    spline=data.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for point,position in zip(spline.bezier_points,points):
        point.co=xyz(*position);point.handle_left_type=point.handle_right_type='AUTO'
    data.bevel_depth=radius;data.bevel_resolution=2
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);data.materials.append(mat)
    return obj


def pillow(name,w,h,d,x,y,z,mat,angle=0):
    # Superellipse upholstery: full soft shoulders and shallow irregular fabric folds.
    vertices=[];faces=[];segments=32;rings=16
    power=lambda value:math.copysign(abs(value)**.38,value)
    for j in range(rings+1):
        phi=-math.pi/2+j*math.pi/rings
        for i in range(segments):
            theta=i*2*math.pi/segments
            px=power(math.cos(phi))*power(math.cos(theta))*w/2
            pz=power(math.cos(phi))*power(math.sin(theta))*d/2
            py=power(math.sin(phi))*h/2
            py+=.008*math.sin(px*19+pz*7)*math.cos(pz*13)*(abs(py)/(h/2))
            vertices.append(xyz(px,py,pz))
    for j in range(rings):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            faces.append((a+segments,b+segments,b,a))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.location=xyz(x,y,z);obj.rotation_euler.x=angle
    finish(obj,name,mat)
    for p in mesh.polygons:p.use_smooth=True
    return obj


def cloth(name,x,z,w,d,y,mat,drop=.14):
    vertices=[];faces=[];nx=42;nz=38
    for j in range(nz+1):
        v=j/nz;zz=z+(v-.5)*d
        for i in range(nx+1):
            u=i/nx;xx=x+(u-.5)*w
            edge=max(0,(abs(u-.5)-.37)/.13)
            height=y-drop*edge**1.7+.017*math.sin(u*42+v*12)+.012*math.sin(v*34-u*8)
            height+=.014*math.sin(u*95)*math.exp(-abs(v-.8)*7)
            vertices.append(xyz(xx,height,zz))
    for j in range(nz):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a+nx+1,a+nx+2,a+1,a))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);finish(obj,name,mat)
    for p in mesh.polygons:p.use_smooth=True
    mod=obj.modifiers.new('Cloth hem thickness','SOLIDIFY');mod.thickness=.012
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def area(name,position,target,energy,size,hex_color='FFE3BE'):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color(hex_color)[:3]
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=xyz(*position)
    obj.rotation_euler=(Vector(xyz(*target))-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


def lamp(name,x,z,y,wood,metal,shade):
    cylinder(name+' base',.13,.025,x,y,z,wood)
    cylinder(name+' stem',.018,.22,x,y+.12,z,metal,vertices=16)
    # Open shade: no opaque cap blocking light onto the table.
    verts=[];faces=[]
    for h,r in [(0,.15),(.23,.105)]:
        for i in range(40):verts.append(xyz(x+r*math.cos(i*math.tau/40),y+.2+h,z+r*math.sin(i*math.tau/40)))
    for i in range(40):faces.append((i+40,(i+1)%40+40,(i+1)%40,i))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name+' linen shade',mesh);bpy.context.collection.objects.link(obj);finish(obj,name,shade)
    for p in mesh.polygons:p.use_smooth=True
    area(name+' warm pool',(x,y+.3,z),(x,y-.3,z),12,.22,'FFD397')


def plant(name,x,z,ground,ceramic,leaf,stem,scale=1):
    cylinder(name+' pot',.16*scale,.3*scale,x,ground+.15*scale,z,ceramic,top=.19*scale)
    for i in range(9):
        a=i*2.399;h=(.45+(i%4)*.13)*scale
        end=(x+math.sin(a)*.28*scale,ground+h,z+math.cos(a)*.28*scale)
        curve(name+' stem',[(x,ground+.28*scale,z),((x+end[0])/2,ground+h*.85,(z+end[2])/2),end],.006*scale,stem)
        # Curved lanceolate leaves rather than stacked green capsules.
        vertices=[];faces=[]
        for j in range(9):
            t=j/8;length=.3*scale;center=(end[0]+math.sin(a)*t*length,end[1]+math.sin(t*math.pi)*.09*scale,end[2]+math.cos(a)*t*length)
            width=math.sin(math.pi*t)*.075*scale
            for side in [-1,0,1]:vertices.append(xyz(center[0]+math.cos(a)*width*side,center[1]+(.014*scale if side==0 else 0),center[2]-math.sin(a)*width*side))
        for j in range(8):
            for k in range(2):q=j*3+k;faces.append((q+3,q+4,q+1,q))
        mesh=bpy.data.meshes.new(name+' leaf');mesh.from_pydata(vertices,[],faces);mesh.update()
        obj=bpy.data.objects.new(name+' leaf',mesh);bpy.context.collection.objects.link(obj);finish(obj,name,leaf)
        for p in mesh.polygons:p.use_smooth=True


def build():
    if (OUT/'community-source.blend').exists():raise FileExistsError('Use a new output folder; source files are retained.')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
    scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=4;scene.cycles.glossy_bounces=3
    scene.render.resolution_x=1440;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.1
    world=bpy.data.worlds.new('Neutral low ambient');scene.world=world;world.use_nodes=True
    background=world.node_tree.nodes.new('ShaderNodeBackground');background.inputs[0].default_value=color('DCE3EE');background.inputs[1].default_value=.11
    world_output=next(node for node in world.node_tree.nodes if node.type=='OUTPUT_WORLD');world.node_tree.links.new(background.outputs[0],world_output.inputs['Surface'])
    wall=material('Ivory mineral plaster','DDD0B6',.93,kind='plaster')
    trim=material('Warm limestone edges','C9BDA6',.83,kind='plaster')
    oak=material('Natural oak grain','B78651',.64,kind='wood')
    walnut=material('Dark oak accents','725035',.6,kind='wood')
    cream=material('Cream woven linen','E2D6BD',.94,kind='fabric')
    olive=material('Olive woven upholstery','82835C',.97,kind='fabric')
    rug=material('Oatmeal loop wool','C5B18E',1,kind='fabric')
    stone=material('Warm honed stone','D8D1C2',.52,kind='stone')
    black=material('Charcoal details','24231C',.48)
    brass=material('Brushed aged brass','A9874A',.37,.65)
    ceramic=material('Ivory ceramic','E5DEC9',.26)
    leaf=material('Matte olive leaves','4E6240',.78)
    stem=material('Plant stems','625338',.8)
    glass=material('Muted window glass','929F98',.23,.25)
    screen=material('Dark television screen','151915',.23,.1)
    paper=material('Paper and pages','EAE1CB',.9)
    tile=material('Kitchen limestone','C8C0AE',.7,kind='stone')
    # Exactly the CE outer footprint and partition positions, never the private home.
    box('Display foundation',8.6,.3,6.6,0,-.25,0,black,.02)
    box('Subfloor',8.3,.16,6.3,0,-.03,0,walnut,.005)
    plank_mats=[material('Oak plank tone '+str(i),c,.69,kind='wood') for i,c in enumerate(['BA8B58','BE905D','B78654','C39765','B98D5D','B18555'])]
    for row in range(29):
        z=-3.15+(row+.5)*6.3/29;start=-4.15-(row%3)*.67
        while start<4.15:
            left=max(-4.15,start);right=min(4.15,start+2.01)
            if right-left>.02:box('Individual oak board',right-left-.008,.025,6.3/29-.007,(left+right)/2,.064,z,random.choice(plank_mats),.003)
            start+=2.01
    for w,h,d,x,y,z in [(8.4,1.65,.15,0,.8,-3.13),(.15,1.65,6.3,-4.13,.8,0),(.15,.3,6.3,4.13,.12,0),(8.4,.3,.15,0,.12,3.13),(.12,1.2,3.6,1.05,.57,-1.3),(3,.85,.12,2.6,.4,.65),(.12,.8,1.4,1.05,.37,2.45)]:
        box('Fictional plaster wall',w,h,d,x,y,z,wall,.008)
    box('Back skirting',8.2,.085,.025,0,.125,-3.035,trim,.004)
    box('Left skirting',.025,.085,6.1,-4.035,.125,0,trim,.004)
    # Entry stone tiles and a woven runner remain inside the same room.
    for x in [1.45,2.2,2.95,3.7]:
        for z in [1.05,1.75,2.45]:box('Entry stone tile',.74,.025,.69,x,.082,z,tile,.003)
    box('Living wool rug',3.1,.035,2.6,-1.8,.096,.65,rug,.025)
    for i in range(30):
        x=-3.27+i*.1
        curve('Rug fringe',[(x,.105,1.94),(x+.012,.106,2.015)],.004,cream)
    # Upholstery layers, separate cushions, seams, soft shoulders and timber feet.
    box('Sofa shadow plinth',2.52,.12,.7,-1.8,.18,-.55,walnut,.035)
    box('Sofa upholstered body',2.8,.29,.85,-1.8,.37,-.55,olive,.085)
    box('Sofa soft back',2.8,.54,.24,-1.8,.69,-.94,olive,.075)
    for x in [-3.12,-.47]:box('Sofa rounded arm',.24,.5,.95,x,.49,-.48,cream,.07)
    for i,x in enumerate([-2.6,-1.8,-1]):
        pillow('Sofa seat',.75,.19,.72,x,.57,-.46,cream)
        pillow('Sofa back cushion',.72,.43,.19,x,.83,-.77,cream,.12)
        curve('Seat piping',[(x-.32,.61,-.12),(x,.615,-.09),(x+.32,.61,-.12)],.005,cream)
    pillow('Olive throw pillow',.38,.35,.14,-2.68,.88,-.57,olive,.23)
    pillow('Linen throw pillow',.35,.32,.14,-.94,.86,-.57,rug,-.17)
    # Sculpted circular coffee table and small objects.
    cylinder('Coffee table oak foot',.36,.32,-1.9,.28,.95,walnut,top=.27)
    cylinder('Coffee table dark top',.61,.065,-1.9,.47,.95,black)
    cylinder('Coffee tray',.18,.018,-1.99,.514,.88,brass)
    cylinder('Small ceramic bowl',.085,.06,-1.99,.551,.88,ceramic,top=.1)
    box('Table book pages',.26,.027,.34,-1.62,.52,1.08,paper,.006)
    box('Book olive cover',.27,.008,.35,-1.62,.539,1.08,olive,.003)
    # Television bench: separate fronts, thin handles and soft edges.
    box('TV oak cabinet',.34,.36,1.9,-3.7,.3,1.25,oak,.025)
    for z in [.65,1.25,1.85]:
        box('TV cabinet front',.028,.3,.57,-3.51,.31,z,oak,.01)
        box('TV cabinet pull',.018,.015,.14,-3.488,.37,z,brass,.004)
    box('Television frame',.075,.82,1.35,-3.74,.99,1.25,black,.025)
    box('Television glass',.01,.72,1.25,-3.696,1.01,1.25,screen,.01)
    box('Television pedestal',.22,.025,.42,-3.7,.51,1.25,black,.005)
    # Bedroom: padded headboard, linen pillows, wrinkled duvet and olive throw.
    box('Bed oak base',1.85,.3,2.4,2.65,.25,-1.5,oak,.055)
    box('Bed mattress',1.82,.22,2.35,2.65,.49,-1.5,cream,.085)
    box('Bed headboard frame',1.95,.8,.14,2.65,.58,-2.73,oak,.04)
    box('Bed headboard upholstery',1.79,.55,.055,2.65,.65,-2.635,olive,.025)
    cloth('Linen duvet',2.65,-1.35,1.93,1.78,.65,cream,.17)
    cloth('Olive bed throw',2.65,-.85,1.96,.55,.695,olive,.2)
    for x in [2.18,3.1]:pillow('Bedroom pillow',.73,.16,.49,x,.68,-2.25,cream)
    box('Bedside table',.54,.48,.55,1.44,.32,-2.3,oak,.025)
    box('Bedside drawer front',.49,.15,.02,1.44,.43,-2.012,oak,.008)
    box('Bedside drawer handle',.13,.014,.018,1.44,.43,-1.991,brass,.003)
    lamp('Bedside light',1.44,-2.3,.575,oak,brass,cream)
    # Kitchen cabinet doors, stone worktop, inset sink and curved faucet.
    box('Kitchen rear carcass',2.5,.85,.65,-2.5,.48,-2.65,walnut,.012)
    for i in range(5):
        x=-3.5+i*.5
        box('Kitchen oak door',.48,.77,.035,x,.5,-2.309,oak,.009)
        box('Kitchen handle',.018,.17,.02,x+.17,.65,-2.28,brass,.004)
    box('Kitchen stone worktop',2.56,.07,.71,-2.5,.94,-2.65,stone,.02)
    box('Kitchen return',.65,.85,1.25,-3.43,.48,-1.74,oak,.012)
    box('Kitchen return worktop',.72,.07,1.25,-3.43,.94,-1.74,stone,.02)
    for z in [-2,-1.47]:box('Return door',.025,.77,.5,-3.09,.5,z,oak,.008)
    box('Sink inset',.58,.012,.4,-2.6,.981,-2.65,black,.055)
    box('Sink interior',.45,.01,.28,-2.6,.99,-2.65,glass,.045)
    curve('Brass faucet',[(-2.6,.99,-2.9),(-2.6,1.25,-2.9),(-2.6,1.29,-2.77),(-2.6,1.17,-2.72)],.013,brass)
    box('Induction glass',.62,.012,.42,-1.78,.985,-2.65,black,.018)
    for x in [-1.63,-1.94]:cylinder('Burner ring',.1,.007,x,1,-2.65,glass)
    box('Refrigerator',.8,1.45,.67,-.78,.8,-2.66,stone,.04)
    box('Refrigerator division',.72,.012,.007,-.78,.55,-2.32,black,.001)
    box('Refrigerator handle',.019,.37,.028,-.45,1,-2.3,brass,.006)
    box('Oak cutting board',.32,.023,.28,-3.45,.992,-1.7,oak,.035)
    cylinder('Utensil pot',.08,.14,-3.47,1.08,-2.2,ceramic)
    for x in [-3.5,-3.44]:curve('Kitchen spoon',[(x,1.08,-2.2),(x+.015,1.3,-2.2)],.009,oak)
    # Entry cabinet, vertical oak slats and a ceramic vessel.
    box('Entry cabinet',.7,.7,1.5,3.7,.43,1.85,oak,.025)
    box('Entry stone top',.72,.075,1.55,3.7,.83,1.85,stone,.016)
    for z in [1.37,1.85,2.33]:
        box('Entry cabinet front',.025,.59,.46,3.333,.43,z,oak,.008)
        box('Entry handle',.018,.16,.015,3.31,.56,z,brass,.004)
    cylinder('Entry ceramic vase',.09,.19,3.7,.97,1.38,ceramic,top=.045)
    box('Entry woven runner',1.6,.025,1.1,2.2,.106,1.9,rug,.02)
    # Window trim and folded curtain; household-neutral details.
    box('Rear window recess',1.74,1.04,.035,-2,.91,-3.041,walnut,.004)
    box('Rear muted glass',1.66,.96,.015,-2,.91,-3.016,glass,.003)
    for x in [-2.83,-2,-1.17]:box('Window mullion',.025,1,.035,x,.91,-2.996,trim,.003)
    for y in [.43,1.39]:box('Window horizontal frame',1.7,.035,.04,-2,y,-2.996,trim,.004)
    box('Left muted glass',.025,.9,1.3,-4.039,.95,.3,glass,.004)
    for z in [-.35,.3,.95]:box('Left window frame',.035,.94,.025,-4.013,.95,z,trim,.003)
    for i in range(8):
        z=-.43+i*.043
        curve('Curtain fold',[(-3.98,1.48,z),(-3.95,.96,z+.007),(-3.99,.38,z)],.025,cream)
    # Same two fictional wall AC positions, now with louvers and rounded shells.
    box('Living AC body',.16,.35,.86,-3.99,1.3,1.7,ceramic,.04)
    box('Living AC outlet',.012,.06,.72,-3.901,1.21,1.7,black,.005)
    box('Bedroom AC body',.88,.35,.16,2.6,1.3,-3.01,ceramic,.04)
    box('Bedroom AC outlet',.72,.06,.012,2.6,1.21,-2.92,black,.005)
    for i in range(4):
        box('AC fine louver',.7,.005,.015,2.6,1.19+i*.012,-2.907,trim,.001)
    plant('Living plant',-3.5,2.7,.08,ceramic,leaf,stem,.9)
    plant('Bedroom plant',3.7,-2.7,.08,ceramic,leaf,stem,.8)
    plant('Kitchen plant',.5,-2.7,.08,ceramic,leaf,stem,.65)
    # A small floor lamp gives the living seating group a believable light source.
    cylinder('Living floor lamp base',.17,.025,-.47,.1,.15,black)
    cylinder('Living floor lamp stem',.014,1.05,-.47,.63,.15,brass,vertices=16)
    lamp('Living linen shade',-.47,.15,1.1,brass,brass,cream)
    area('Large softbox',(-3,6,3),(0,0,0),650,5,'FFE6CA')
    area('Soft fill',(4,4,-2),(0,.4,0),260,4,'E1E9F3')
    area('Kitchen warm ceiling',(-2.5,2.7,-2.1),(-2.5,.2,-2.1),80,2,'FFE2B4')
    area('Bedroom warm ceiling',(2.7,2.8,-1.5),(2.7,.2,-1.5),95,2.1,'FFE0AE')
    area('Living warm ceiling',(-1.8,2.8,.2),(-1.8,.2,.2),105,2.3,'FFE0AE')
    camdata=bpy.data.cameras.new('CE overview');cam=bpy.data.objects.new('CE overview',camdata);bpy.context.collection.objects.link(cam)
    cam.location=xyz(10,12,13);cam.rotation_euler=(Vector(xyz(0,.1,0))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=12.8;scene.camera=cam
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'community-source.blend'))
    scene.render.filepath=str(OUT/'overview.png');bpy.ops.render.render(write_still=True)
    print('CE_RENDER_COMPLETE',flush=True)


def bake():
    if (OUT/'community-detail.glb').exists():raise FileExistsError('GLB already exists; retain old output and use a new build folder.')
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'community-source.blend'))
    scene=bpy.context.scene
    bpy.ops.object.select_all(action='DESELECT')
    objects=[o for o in scene.objects if o.type in {'MESH','CURVE'}]
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.convert(target='MESH');bpy.ops.object.join();model=bpy.context.object;model.name='Community fictional apartment'
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Bake into scene-linear floats. An 8-bit target clips highlights before the
    # display transform and permanently flattens linen, pillows and stone.
    atlas=bpy.data.images.new('CE original HDR lighting',width=4096,height=4096,float_buffer=True)
    atlas.colorspace_settings.name='Linear Rec.709'
    for mat in model.data.materials:
        if not mat:continue
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=atlas;mat.node_tree.nodes.active=node
    scene.cycles.samples=32
    scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True
    scene.render.bake.use_pass_diffuse=True;scene.render.bake.use_pass_glossy=True;scene.render.bake.use_pass_transmission=False;scene.render.bake.use_pass_emit=True;scene.render.bake.margin=6
    bpy.ops.object.bake(type='COMBINED')
    atlas.filepath_raw=str(OUT/'community-lighting.exr');atlas.file_format='OPEN_EXR';atlas.save()
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.5
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
    atlas.save_render(str(OUT/'community-atlas.png'),scene=scene)
    # Export the display-transformed PNG, never the unclamped float bake.
    display_atlas=bpy.data.images.load(str(OUT/'community-atlas.png'),check_existing=False)
    display_atlas.colorspace_settings.name='sRGB'
    web=bpy.data.materials.new('CE baked light and textures');web.use_nodes=True;nodes=web.node_tree.nodes;links=web.node_tree.links;nodes.clear()
    tex=nodes.new('ShaderNodeTexImage');tex.image=display_atlas;emission=nodes.new('ShaderNodeEmission');out=nodes.new('ShaderNodeOutputMaterial')
    links.new(tex.outputs['Color'],emission.inputs['Color']);links.new(emission.outputs[0],out.inputs['Surface'])
    model.data.materials.clear();model.data.materials.append(web)
    for p in model.data.polygons:p.material_index=0
    for o in scene.objects:o.select_set(o==model)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'community-detail.glb'),export_format='GLB',use_selection=True,export_extras=False,export_cameras=False,export_lights=False,export_apply=True)
    metadata={'fictional':True,'source':'scripts/create-community-model.py','materials':'original procedural','lighting':'Cycles float bake with AgX display transform','triangles':sum(len(p.vertices)-2 for p in model.data.polygons),'bytes':(OUT/'community-detail.glb').stat().st_size,'source_objects':len(objects)}
    (OUT/'build-manifest.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print('CE_BAKE_COMPLETE '+json.dumps(metadata),flush=True)


if args.bake:bake()
else:build()
